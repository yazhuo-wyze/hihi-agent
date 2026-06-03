'use client';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface Model {
  id: string;
  provider: string;
}

export default function Home() {
  const [models, setModels] = useState<Model[]>([]);
  const [currentModel, setCurrentModel] = useState<string>('');
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch('/api/models')
      .then((r) => r.json())
      .then((d) => {
        setModels(d.models || []);
        setCurrentModel(d.currentModel || d.models?.[0]?.id || '');
      });
  }, []);

  const send = async () => {
    if (!input.trim() || streaming) return;
    const userMsg = { role: 'user', content: input };
    setMessages((m) => [...m, userMsg, { role: 'assistant', content: '' }]);
    setInput('');
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMsg.content, model: currentModel, mode: 'ask' }),
        signal: ctrl.signal,
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let acc = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        const lines = acc.split('\n');
        acc = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const ev = JSON.parse(payload);
            if (ev.type === 'message' && ev.data?.content) {
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = {
                  role: 'assistant',
                  content: (copy[copy.length - 1].content || '') + ev.data.content,
                };
                return copy;
              });
            }
          } catch {
            /* ignore */
          }
        }
      }
    } catch (err: any) {
      setMessages((m) => [...m, { role: 'system', content: '错误: ' + (err?.message || err) }]);
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h1 className="text-lg font-semibold">hihi-agent</h1>
        <select
          className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm"
          value={currentModel}
          onChange={(e) => setCurrentModel(e.target.value)}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id} ({m.provider})
            </option>
          ))}
        </select>
      </header>
      <main className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === 'user'
                ? 'bg-zinc-800 rounded p-3'
                : m.role === 'system'
                ? 'bg-red-900/40 rounded p-3 text-red-200'
                : 'bg-zinc-900 rounded p-3'
            }
          >
            <div className="text-xs text-zinc-500 mb-1">{m.role}</div>
            <div className="prose prose-invert max-w-none">
              <ReactMarkdown>
                {m.content || (streaming && i === messages.length - 1 ? '…' : '')}
              </ReactMarkdown>
            </div>
          </div>
        ))}
      </main>
      <footer className="border-t border-zinc-800 p-3 flex gap-2">
        <textarea
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded p-2 text-sm"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
        />
        {streaming ? (
          <button onClick={stop} className="bg-red-600 hover:bg-red-700 px-4 rounded text-sm">
            停止
          </button>
        ) : (
          <button onClick={send} className="bg-blue-600 hover:bg-blue-700 px-4 rounded text-sm">
            发送
          </button>
        )}
      </footer>
    </div>
  );
}
