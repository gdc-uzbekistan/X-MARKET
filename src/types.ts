export interface UserPermissions {
  can_order: boolean;
  can_chat: boolean;
  can_review: boolean;
}

export interface SellerProfile {
  id: number;
  user_id: number;
  store_name: string;
  description: string | null;
  phone: string | null;
  region: string | null;
  district: string | null;
  authorized_by_admin: number;
  status: 'pending' | 'approved' | 'suspended';
  created_at: string;
  profile_id?: string;
}

export interface CustomerUser {
  id: number;
  profile_id: string;
  full_name: string;
  phone: string;
  region: string;
  district: string;
  avatar_url: string | null;
  latitude: number | null;
  longitude: number | null;
  location_address: string | null;
  phone_verified: number;
  role: string;
  status: string;
  permissions: UserPermissions;
  created_at?: string;
  seller?: SellerProfile | null;
}

export interface AdminUser {
  id: number;
  username: string;
  full_name: string;
  telegram_handle: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  image_url: string | null;
  description: string | null;
  sort_order: number;
  product_count?: number;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface Product {
  id: number;
  seller_id: number | null;
  seller?: SellerProfile | null;
  category_id: number | null;
  category_name: string | null;
  name: string;
  slug: string;
  description: string;
  original_price: number;
  discounted_price: number | null;
  effective_price: number;
  discount_percent: number;
  weight: string;
  quantity: number;
  stock_value: number;
  is_available: boolean;
  is_featured: boolean;
  specs: ProductSpec[];
  tags: string[];
  images: string[];
  sales_count: number;
  views_count: number;
  avg_rating: number;
  review_count: number;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  cart_item_id: number;
  product_id: number;
  quantity: number;
  product: Product;
  line_original: number;
  line_total: number;
}

export interface CartSummary {
  cart_id: number;
  items: CartItem[];
  item_count: number;
  subtotal_original: number;
  subtotal: number;
  item_discount_total: number;
  delivery_fee: number;
  estimated_total: number;
}

export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Processing'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled'
  | 'Refunded';

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number | null;
  seller_id: number | null;
  product_name: string;
  product_image: string | null;
  unit_original_price: number;
  unit_price: number;
  weight: string | null;
  quantity: number;
  line_total: number;
}

export interface OrderHistoryEntry {
  id?: number;
  status: string;
  note: string | null;
  changed_by?: string;
  created_at: string;
}

export interface Order {
  id: number;
  order_number: string;
  user_id: number;
  customer_profile_id?: string;
  customer_name: string;
  customer_phone: string;
  region: string;
  district: string;
  delivery_address: string;
  delivery_instructions: string | null;
  latitude: number | null;
  longitude: number | null;
  subtotal: number;
  item_discount_total: number;
  promo_code: string | null;
  promo_discount: number;
  delivery_fee: number;
  total_amount: number;
  status: OrderStatus;
  internal_notes?: string;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  history: OrderHistoryEntry[];
}

export interface PromoCode {
  id: number;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_discount: number | null;
  expires_at: string | null;
  usage_limit: number | null;
  per_customer_limit: number;
  used_count: number;
  is_active: number;
  applicable_category_ids_json: string;
  applicable_product_ids_json: string;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  sender_role: 'customer' | 'admin' | 'seller';
  sender_id: number;
  content: string;
  image_url: string | null;
  is_read: number;
  created_at: string;
}

export interface AppNotification {
  id: number;
  recipient_role: 'customer' | 'admin';
  recipient_id: number;
  type: string;
  title: string;
  body: string;
  link_page: string | null;
  reference_id: string | null;
  is_read: number;
  created_at: string;
}
