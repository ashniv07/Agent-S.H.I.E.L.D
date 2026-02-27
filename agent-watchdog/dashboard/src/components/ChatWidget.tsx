import { useState, useCallback, useRef, useEffect } from 'react';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { authFetch } from '../utils/api';
import botIcon from '../styles/icons/bot-icon.png';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: crypto.randomUUID(),
    role: 'assistant',
    text: 'agent S.H.I.E.L.D AI is ready. Ask me anything about your live system — risk posture, blocked agents, recent violations, or pipeline activity.',
    timestamp: new Date().toISOString(),
  }]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const getChatHistory = useCallback(() =>
    messages
      .filter((m, i) => !(m.role === 'assistant' && i === 0))
      .map((m) => ({ role: m.role, content: m.text })),
    [messages]
  );

  const sendMessage = useCallback(async () => {
    const input = chatInput.trim();
    if (!input || chatLoading) return;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: input,
      timestamp: new Date().toISOString(),
    };
    setMessages((p) => [...p, userMsg]);
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await authFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, history: getChatHistory() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? `Error ${res.status}`);
      }
      const data = await res.json() as { reply: string; timestamp: string };
      setMessages((p) => [...p, {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: data.reply,
        timestamp: data.timestamp,
      }]);
    } catch (err) {
      setMessages((p) => [...p, {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: `Error: ${err instanceof Error ? err.message : 'Unknown error. Please try again.'}`,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, getChatHistory]);

  const unreadCount = messages.filter((m) => m.role === 'assistant').length - 1;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">

      {/* ── Chat panel ──────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="mb-3 flex flex-col rounded-2xl overflow-hidden"
          style={{
            width: 'min(94vw, 500px)',
            height: 'min(82vh, 700px)',
            background: 'var(--c-bg, #070d1a)',
            border: '1px solid rgba(34,211,238,0.2)',
            boxShadow: '0 0 70px rgba(34,211,238,0.08), 0 28px 72px rgba(0,0,0,0.62)',
            animation: 'chatExpandIn 0.24s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{
              background: 'rgba(34,211,238,0.04)',
              borderBottom: '1px solid rgba(34,211,238,0.12)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)' }}
              >
                <img src={botIcon} alt="AI" className="w-3.5 h-3.5 object-contain" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100 leading-tight">AI Assistant</p>
                <p className="text-xs leading-tight" style={{ color: '#22d3ee' }}>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1 align-middle" />
                  Ready
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 transition-colors"
              style={{ color: '#475569' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'transparent'; }}
            >
              <CloseOutlinedIcon style={{ fontSize: 15 }} />
            </button>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto p-3 space-y-2.5"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}
          >
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 mr-1.5"
                    style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)' }}
                  >
                    <SmartToyOutlinedIcon style={{ fontSize: 11, color: '#22d3ee' }} />
                  </div>
                )}
                <div
                  className="max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm"
                  style={{
                    background: msg.role === 'user'
                      ? 'rgba(34,211,238,0.1)'
                      : 'var(--c-surface, #0f172a)',
                    border: `1px solid ${msg.role === 'user' ? 'rgba(34,211,238,0.2)' : 'var(--c-border, #1e293b)'}`,
                    color: msg.role === 'user' ? '#a5f3fc' : '#cbd5e1',
                  }}
                >
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                  <p className="mt-1.5 text-[11px] font-mono" style={{ color: '#475569' }}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 mr-1.5"
                  style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)' }}
                >
                  <SmartToyOutlinedIcon style={{ fontSize: 11, color: '#22d3ee' }} />
                </div>
                <div
                  className="rounded-xl px-3 py-2"
                  style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
                >
                  <span className="inline-flex gap-1">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="animate-bounce text-xs text-slate-500"
                        style={{ animationDelay: `${delay}ms` }}
                      >
                        ●
                      </span>
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input row */}
          <div
            className="flex gap-2 p-3 flex-shrink-0"
            style={{ borderTop: '1px solid rgba(34,211,238,0.08)' }}
          >
            <input
              ref={inputRef}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) void sendMessage(); }}
              placeholder="Ask about agents, violations, risk…"
              disabled={chatLoading}
              className="flex-1 rounded-xl px-3.5 py-2.5 text-sm outline-none"
              style={{
                background: 'var(--c-surface)',
                border: '1px solid var(--c-border)',
                color: '#e2e8f0',
                transition: 'border-color 150ms',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(34,211,238,0.35)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--c-border)'; }}
            />
            <button
              onClick={() => void sendMessage()}
              disabled={chatLoading || !chatInput.trim()}
              className="rounded-xl px-3 py-2 flex items-center justify-center transition-opacity disabled:opacity-40"
              style={{
                background: 'rgba(34,211,238,0.1)',
                border: '1px solid rgba(34,211,238,0.22)',
                color: '#a5f3fc',
              }}
            >
              <SendOutlinedIcon style={{ fontSize: 17 }} />
            </button>
          </div>
        </div>
      )}

      {/* ── Floating toggle button ───────────────────────────────────── */}
      <button
        onClick={() => setIsOpen((p) => !p)}
        className="relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200"
        style={{
          background: isOpen
            ? 'rgba(34,211,238,0.18)'
            : 'rgba(34,211,238,0.1)',
          border: '1.5px solid rgba(34,211,238,0.3)',
          boxShadow: isOpen
            ? '0 0 34px rgba(34,211,238,0.24), 0 10px 28px rgba(0,0,0,0.42)'
            : '0 0 20px rgba(34,211,238,0.16), 0 6px 20px rgba(0,0,0,0.42)',
          transform: isOpen ? 'scale(1.08)' : 'scale(1)',
          animation: isOpen ? 'none' : 'chatFloat 3.6s ease-in-out infinite',
        }}
        title="AI Assistant"
      >
        {isOpen ? (
          <CloseOutlinedIcon style={{ fontSize: 30, color: '#22d3ee' }} />
        ) : (
          <img src={botIcon} alt="AI Assistant" className="w-9 h-9 object-contain" />
        )}
        {/* Unread badge */}
        {!isOpen && unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
            style={{ background: '#22d3ee', color: '#070d1a' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <style>{`
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes chatExpandIn {
          from { opacity: 0; transform: translateY(16px) scale(0.93); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes chatFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}

