import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MessageCircleMore, RefreshCw, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeTable } from "@/hooks/useRealtime";
import { listRequestMessages, sendRequestMessage } from "@/services/supabaseData";
import type { RequestMessage } from "@/types/app";

function formatMessageTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRoleLabel(role: string) {
  if (role === "driver") return "Driver";
  if (role === "mechanic") return "Mechanic";
  if (role === "admin") return "Admin";
  return "Customer";
}

function RequestChatPanel({
  requestId,
  title = "In-app chat",
  description = "Chat with the other party while this request is active.",
  className = "",
}: {
  requestId: string;
  title?: string;
  description?: string;
  className?: string;
}) {
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const [messages, setMessages] = useState<RequestMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const loadMessages = useCallback(async () => {
    if (!requestId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await listRequestMessages(requestId);
      setMessages(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load chat messages.");
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useRealtimeTable(
    "request_messages",
    () => {
      void loadMessages();
    },
    `request_id=eq.${requestId}`,
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = draft.trim();
    if (!trimmed || sending) {
      return;
    }

    setSending(true);
    setError(null);

    try {
      await sendRequestMessage(requestId, trimmed);
      setDraft("");
      await loadMessages();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to send message.");
    } finally {
      setSending(false);
    }
  };

  const handleRefresh = () => {
    void loadMessages();
  };

  return (
    <Card className={`border-white/10 bg-slate-950/80 text-slate-50 ${className}`.trim()}>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessageCircleMore className="h-5 w-5 text-sky-300" />
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
            onClick={handleRefresh}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
        <CardDescription className="text-slate-300">{description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="rounded-2xl border border-white/10 bg-slate-900/70">
          <div className="max-h-80 space-y-3 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center gap-3 py-10 text-slate-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading chat...
              </div>
            ) : messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-slate-400">
                No messages yet. Start the conversation here.
              </div>
            ) : (
              messages.map((message) => {
                const isOwnMessage = currentUserId === message.senderId;

                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl border px-4 py-3 ${
                        isOwnMessage
                          ? "border-sky-500/20 bg-sky-500/10 text-sky-50"
                          : "border-white/10 bg-white/5 text-slate-100"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white">{message.senderName}</p>
                          <Badge className="border-white/10 bg-white/10 text-[10px] uppercase tracking-[0.18em] text-slate-200">
                            {getRoleLabel(message.senderRole)}
                          </Badge>
                        </div>
                        <span className="text-xs text-slate-400">
                          {formatMessageTime(message.createdAt)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-100">
                        {message.message}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={endRef} />
          </div>
        </div>

        <form className="space-y-3" onSubmit={handleSend}>
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type your message..."
            rows={3}
            className="border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-sky-500"
            disabled={sending}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              Messages are only visible to the customer and assigned driver while the request is active.
            </p>
            <Button
              type="submit"
              className="bg-sky-500 text-white hover:bg-sky-400"
              disabled={sending || !draft.trim()}
            >
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export { RequestChatPanel };
export default RequestChatPanel;
