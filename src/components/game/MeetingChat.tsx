"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface ChatMsg {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  createdAt: string;
}

interface MeetingChatProps {
  meetingId: string;
  isAlive: boolean;
  currentParticipantId?: string;
}

export function MeetingChat({ meetingId, isAlive, currentParticipantId }: MeetingChatProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/game/chat?meetingId=${meetingId}&as=PARTICIPANT`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setMessages(data);
        }
      }
    } catch {
      /* ignore background poll errors */
    }
  }, [meetingId]);

  useEffect(() => {
    void fetchMessages();
    const interval = setInterval(() => void fetchMessages(), 2500);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || !isAlive || sending) return;

    setSending(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/game/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId, message: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to send message");
      }
      setInputText("");
      await fetchMessages();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to send");
      setTimeout(() => setErrorMsg(null), 3000);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-[2.5rem] border border-white/[0.08] bg-[#12121A]/60 backdrop-blur-[30px] p-4 space-y-3 flex flex-col h-72">
      <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
        <span className="text-[11px] font-mono font-bold uppercase text-zinc-300 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          COMMUNICATIONS CHANNEL
        </span>
        <span className="text-[10px] font-mono text-zinc-500">
          {isAlive ? "OPERATIVE SECURE" : "GHOST PROTOCOL (READ ONLY)"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-left text-xs font-mono">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-600 text-xs">
            No transmissions yet. Start discussion below.
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.senderId === currentParticipantId;
            return (
              <div
                key={m.id}
                className={`p-2 rounded-xl max-w-[85%] break-words ${
                  isMe
                    ? "ml-auto bg-[#00F0FF]/10 border border-cyan-800/40 text-cyan-200"
                    : "mr-auto bg-black/50 border border-white/[0.08] text-zinc-200"
                }`}
              >
                <div className="text-[9px] font-bold text-zinc-400 mb-0.5 flex items-center justify-between gap-2">
                  <span>{m.senderName}</span>
                  <span className="text-zinc-600">
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
                <div className="text-xs leading-relaxed">{m.message}</div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {errorMsg && (
        <div className="text-[10px] font-mono text-[#FF3B5C] bg-[#FF3B5C]/10 border border-[#FF3B5C]/30 px-2 py-1 rounded">
          {errorMsg}
        </div>
      )}

      {isAlive ? (
        <form onSubmit={handleSend} className="flex gap-2 pt-1 border-t border-zinc-850">
          <input
            type="text"
            required
            maxLength={200}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type broadcast message..."
            disabled={sending}
            className="flex-1 px-3 py-2 rounded-xl bg-black/50 border border-white/[0.08] text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={sending || !inputText.trim()}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-mono text-xs font-bold uppercase transition-colors"
          >
            {sending ? "..." : "Send"}
          </button>
        </form>
      ) : (
        <div className="p-2 rounded-xl bg-black/50/60 border border-white/[0.08] text-center text-[10px] font-mono text-zinc-500">
          👻 You are eliminated. Dead players cannot speak during meetings.
        </div>
      )}
    </div>
  );
}
