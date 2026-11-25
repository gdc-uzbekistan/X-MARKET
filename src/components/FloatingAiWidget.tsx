import { Bot, Maximize2, Send, X } from 'lucide-react';
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext.tsx';
import { apiRequest } from '../lib/api.ts';
import type { Product } from '../types.ts';
import { SafeImage } from './SafeImage.tsx';

interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
  recommendedProducts?: Product[];
}

export function FloatingAiWidget() {
  const { currentPath, navigate } = useStore();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AiMessage[]>([
    {
      role: 'assistant',
      content:
        'Hello! I am X-MARKET AI. Ask me to find products, compare prices, explain discounts, check promo codes, or guide you on delivery and order tracking.',
    },
  ]);

  if (currentPath.startsWith('/admin') || currentPath === '/ai') {
    return null;
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const nextHistory = [...messages, { role: 'user' as const, content: text }];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);

    try {
      const res = await apiRequest<{ reply: string; recommendedProducts: Product[] }>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: text,
          history: nextHistory.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.reply,
          recommendedProducts: res.recommendedProducts,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: err.message || 'Unable to reach X-MARKET AI right now.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open ? (
        <div className="w-[360px] max-w-[calc(100vw-2.5rem)] h-[500px] max-h-[calc(100vh-5rem)] rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#243B2E] shadow-xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 bg-[#14532D] text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src="/src/assets/images/xmarket_ai_emblem_1795608273523.jpg"
                alt="X-MARKET AI"
                className="w-7 h-7 rounded-lg object-cover"
              />
              <div>
                <p className="text-sm font-display font-semibold leading-tight">X-MARKET AI</p>
                <p className="text-[11px] text-emerald-200">Live catalog assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate('/ai');
                }}
                aria-label="Open full screen AI assistant"
                className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close AI assistant"
                className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-[#F8FAF9] dark:bg-[#0B120E]">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-[#1F7A4D] text-white'
                      : 'bg-white dark:bg-[#15241C] border border-slate-200 dark:border-[#243B2E] text-slate-800 dark:text-slate-100'
                  }`}
                >
                  {m.content}
                </div>
                {m.recommendedProducts && m.recommendedProducts.length > 0 ? (
                  <div className="mt-2 w-full space-y-1.5">
                    {m.recommendedProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          navigate(`/product/${p.id}`);
                        }}
                        className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-[#15241C] border border-slate-200 dark:border-[#243B2E] hover:border-[#2E8B57] text-left cursor-pointer"
                      >
                        <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0">
                          <SafeImage src={p.images[0]} alt={p.name} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {p.name}
                          </p>
                          <p className="text-xs font-mono text-[#14532D] dark:text-[#6EE7B7] tabular-nums">
                            ${p.effective_price.toFixed(2)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {loading ? (
              <div className="text-xs text-slate-500 dark:text-slate-400 px-2">X-MARKET AI is thinking...</div>
            ) : null}
          </div>

          <form onSubmit={sendMessage} className="p-3 bg-white dark:bg-[#121F18] border-t border-slate-200 dark:border-[#243B2E] flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about products, prices, or orders..."
              className="flex-1 px-3 py-2 text-sm rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#2E8B57]"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send message to X-MARKET AI"
              className="p-2.5 rounded-xl bg-[#1F7A4D] hover:bg-[#14532D] text-white disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#14532D] hover:bg-[#0F3D26] text-white shadow-lg transition-transform duration-150 hover:-translate-y-0.5 cursor-pointer"
        >
          <Bot className="w-5 h-5" />
          <span className="text-sm font-display font-semibold whitespace-nowrap">X-MARKET AI</span>
        </button>
      )}
    </div>
  );
}
