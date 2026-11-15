'use client';

import React, { useState, useRef, useEffect } from 'react';
import { BRAND } from '../lib/brand';

interface Message {
  sender: 'user' | 'assistant' | 'system';
  text: string;
  time: string;
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'assistant',
      text: 'Hello! Welcome to MAHI Browser. How can I help you today? Ask me about stealth fingerprints, proxy setup, dual engine, or enterprise pricing.',
      time: 'Just now',
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = input.trim();
    if (!query || loading) return;

    const userMsg: Message = {
      sender: 'user',
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/commercial/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query }),
      });

      if (res.ok) {
        const data = await res.json();
        const replyText = data.reply || data.message || 'Thank you for reaching out. Our support engineering team will assist you.';
        setMessages((prev) => [
          ...prev,
          {
            sender: 'assistant',
            text: replyText,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else {
        throw new Error('Support service endpoint unavailable');
      }
    } catch {
      // Graceful offline / direct escalation fallback
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: `For instant priority assistance, you can also reach Munna Bhai directly on WhatsApp/Call at ${BRAND.phone} or email ${BRAND.officialEmail}.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-xl shadow-red-900/40 transition hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-red-500/40"
          aria-label="Open support chat"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}

      {isOpen && (
        <div className="flex h-[480px] w-[350px] sm:w-[380px] flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <img
                  src={BRAND.assets.logo}
                  alt="MAHI"
                  width={24}
                  height={24}
                  draggable={false}
                  className="h-6 w-6 object-contain rounded select-none"
                  style={{ userSelect: 'none' }}
                />
                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-slate-950" />
              </div>
              <div>
                <p className="text-xs font-bold leading-tight">MAHI AI Support Desk</p>
                <p className="text-[10px] text-emerald-400">Online & Verified</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="Close support chat"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-red-600 text-white rounded-br-none'
                      : 'bg-slate-800 text-slate-200 border border-slate-700/60 rounded-bl-none'
                  }`}
                >
                  {m.text}
                </div>
                <span className="mt-1 text-[9px] text-slate-400 px-1">{m.time}</span>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/60 rounded-xl px-3 py-2 w-24">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-red-400" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-red-400 [animation-delay:0.2s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-red-400 [animation-delay:0.4s]" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <form onSubmit={handleSend} className="border-t border-slate-800 bg-slate-950 p-2.5 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a technical or pricing question..."
              className="flex-1 rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-red-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-xl bg-red-600 p-2 text-white hover:bg-red-500 disabled:opacity-40 transition"
              aria-label="Send message"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
