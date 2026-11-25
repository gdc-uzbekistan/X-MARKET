import { GoogleGenAI, Type } from '@google/genai';
import { db } from './db.ts';

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export async function runMarketplaceAi(
  message: string,
  history: ChatTurn[],
  customerId: number | null
): Promise<{ reply: string; recommendedProductIds: number[] }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  // Query live database state so X-MARKET AI never fabricates products, prices, promos, or orders
  const categories = db
    .prepare('SELECT id, name, slug, parent_id, description FROM categories ORDER BY sort_order ASC, name ASC')
    .all() as any[];

  const products = db
    .prepare(
      `SELECT p.id, p.name, p.description, p.original_price, p.discounted_price, p.discount_percent,
              p.weight, p.quantity, p.is_available, p.is_featured, p.specs_json, p.tags_json,
              p.sales_count, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ORDER BY p.is_featured DESC, p.sales_count DESC, p.id DESC
       LIMIT 100`
    )
    .all() as any[];

  const activePromos = db
    .prepare(
      `SELECT code, discount_type, discount_value, min_order_amount, max_discount, expires_at
       FROM promo_codes
       WHERE is_active = 1 AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))`
    )
    .all() as any[];

  let customerOrders: any[] = [];
  if (customerId) {
    customerOrders = db
      .prepare(
        `SELECT order_number, status, total_amount, promo_code, region, district, delivery_address, created_at
         FROM orders
         WHERE user_id = ?
         ORDER BY id DESC
         LIMIT 15`
      )
      .all(customerId) as any[];
  }

  const catalogSnapshot = {
    categories: categories.map((c) => ({ id: c.id, name: c.name, description: c.description })),
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category_name || 'Uncategorized',
      originalPrice: p.original_price,
      discountedPrice: p.discounted_price,
      effectivePrice: p.discounted_price ?? p.original_price,
      discountPercent: p.discount_percent,
      weight: p.weight,
      inStockQuantity: p.quantity,
      isAvailable: Boolean(p.is_available) && p.quantity > 0,
      isFeatured: Boolean(p.is_featured),
      tags: safeParseJson(p.tags_json, []),
      specs: safeParseJson(p.specs_json, []),
      description: String(p.description || '').slice(0, 240),
    })),
    activePromoCodes: activePromos,
    customerOrders,
  };

  const systemInstruction = `You are X-MARKET AI, the official intelligent shopping assistant for the X-MARKET online marketplace.

STRICT GROUNDING RULES:
1. You MUST ONLY reference products, prices, discounts, weights, stock quantities, categories, promo codes, and customer orders present in the LIVE DATABASE SNAPSHOT below.
2. NEVER invent, guess, or hallucinate product availability, prices, discounts, promo codes, or order statuses.
3. If the catalog currently has 0 products or no product matches the user's criteria, state that clearly and honestly, and suggest checking back soon or contacting the administrator.
4. For order questions: if the user is signed in, check customerOrders in the snapshot. If they aren't signed in or ask about an order not listed, guide them to Sign In or use the Order Tracking page (/orders/track) with their AB12345678 Order ID.
5. When recommending specific products from the snapshot, include their numeric product IDs in recommendedProductIds so the UI renders interactive product cards.
6. If the customer needs human assistance, custom inquiries, or unresolved order issues, direct them to the internal Customer Support Chat (/support) or the permanent Telegram support link (https://t.me/RAHMATAL1EV).
7. Keep responses concise, helpful, clear, and accurate. Respond in the same language the customer uses (e.g., English or Uzbek).

LIVE DATABASE SNAPSHOT:
${JSON.stringify(catalogSnapshot)}`;

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const conversationLines = history
    .slice(-10)
    .map((h) => `${h.role === 'user' ? 'Customer' : 'X-MARKET AI'}: ${h.content}`)
    .join('\n');

  const promptContent = conversationLines
    ? `${conversationLines}\nCustomer: ${message}`
    : message;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: promptContent,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reply: {
            type: Type.STRING,
            description: 'Helpful grounded answer to the customer.',
          },
          recommendedProductIds: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
            description: 'Array of existing product IDs from the database snapshot recommended to the user.',
          },
        },
        required: ['reply', 'recommendedProductIds'],
      },
    },
  });

  const rawText = (response.text || '{}').trim();
  const parsed = JSON.parse(rawText) as { reply?: string; recommendedProductIds?: number[] };
  const validIds = new Set(products.map((p) => p.id));
  const safeIds = Array.isArray(parsed.recommendedProductIds)
    ? parsed.recommendedProductIds.filter((id) => typeof id === 'number' && validIds.has(id))
    : [];

  return {
    reply: parsed.reply || 'How can I help you explore X-MARKET today?',
    recommendedProductIds: Array.from(new Set(safeIds)).slice(0, 6),
  };
}

function safeParseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
