import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, CheckCheck, Plus, RotateCcw, Search, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  getConversation, getMessages, listConversations, markRead, searchUsers, sendMessage, startConversation, MESSAGE_MAX,
} from "@/lib/messaging.functions";
import { initials, mergeMessages, shortTime } from "./messageUtils";

export const conversationsKey = ["conversations"];

function Avatar({ name, size = "size-11" }) {
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary`}>
      {initials(name)}
    </span>
  );
}

/** Inbox-level realtime: RLS only delivers messages from the user's own conversations. */
export function useInboxRealtime(enabled) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel("inbox")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () =>
        queryClient.invalidateQueries({ queryKey: conversationsKey })
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") queryClient.invalidateQueries({ queryKey: conversationsKey });
      });
    return () => { supabase.removeChannel(channel); };
  }, [enabled, queryClient]);
}

function UserSearch({ onOpen, onClose }) {
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  const [opening, setOpening] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const results = useQuery({
    queryKey: ["user-search", debounced],
    queryFn: () => searchUsers({ data: { query: debounced } }),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  async function open(user) {
    setError("");
    setOpening(user.id);
    try {
      const { id } = await startConversation({ data: { userId: user.id } });
      onOpen(id);
    } catch (err) {
      setError(err?.message || "Could not open this conversation.");
    } finally {
      setOpening(null);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">New message</p>
        <button type="button" onClick={onClose} aria-label="Close search" className="text-muted-foreground">
          <X className="size-4" />
        </button>
      </div>
      <label className="field flex items-center gap-2">
        <Search className="size-4 text-muted-foreground" />
        <input
          autoFocus
          value={text}
          maxLength={40}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search by display name"
          aria-label="Search users"
          className="w-full bg-transparent outline-none"
        />
      </label>
      {text.trim().length > 0 && text.trim().length < 2 && (
        <p className="text-xs text-muted-foreground">Type at least 2 characters.</p>
      )}
      {results.isFetching && <p className="text-xs text-muted-foreground">Searching…</p>}
      {results.isError && <p role="alert" className="text-xs text-destructive">Search failed. Try again.</p>}
      {results.data?.length === 0 && debounced.length >= 2 && !results.isFetching && (
        <p className="text-xs text-muted-foreground">No users found.</p>
      )}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <ul className="space-y-1">
        {results.data?.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              disabled={!!opening}
              onClick={() => open(u)}
              className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-muted disabled:opacity-60"
            >
              <Avatar name={u.displayName} size="size-9" />
              <span className="truncate text-sm font-medium">{u.displayName}</span>
              {opening === u.id && <span className="ml-auto text-xs text-muted-foreground">Opening…</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Inbox({ onOpen }) {
  const [searching, setSearching] = useState(false);
  const conversations = useQuery({ queryKey: conversationsKey, queryFn: () => listConversations() });

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Messages</h1>
          <p className="mt-1 text-sm text-muted-foreground">Private 1-to-1 chats.</p>
        </div>
        {!searching && (
          <Button className="btn-primary" onClick={() => setSearching(true)}>
            <Plus className="mr-1 size-4" /> New
          </Button>
        )}
      </div>

      {searching && <UserSearch onOpen={onOpen} onClose={() => setSearching(false)} />}

      {conversations.isLoading && <p className="text-sm text-muted-foreground">Loading conversations…</p>}
      {conversations.isError && (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>Could not load your messages.</p>
          <Button className="btn-ghost" onClick={() => conversations.refetch()}>Try again</Button>
        </div>
      )}
      {conversations.data?.length === 0 && !searching && (
        <div className="space-y-3 rounded-2xl border border-border p-5 text-center">
          <p className="text-sm text-muted-foreground">No conversations yet.</p>
          <Button className="btn-primary w-full" onClick={() => setSearching(true)}>Start a conversation</Button>
        </div>
      )}

      <ul className="space-y-2">
        {conversations.data?.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onOpen(c.id)}
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left hover:border-primary/40"
            >
              <Avatar name={c.otherName} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className={`truncate text-sm ${c.unread ? "font-bold" : "font-medium"}`}>{c.otherName}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{shortTime(c.lastMessageAt)}</span>
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2">
                  <span className={`truncate text-xs ${c.unread ? "text-foreground" : "text-muted-foreground"}`}>
                    {c.lastMessage ? `${c.lastMessageMine ? "You: " : ""}${c.lastMessage}` : "No messages yet"}
                  </span>
                  {c.unread > 0 && (
                    <span aria-label={`${c.unread} unread`} className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                      {c.unread > 99 ? "99+" : c.unread}
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function Chat({ conversationId, onBack }) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState([]);
  const [me, setMe] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [otherReadAt, setOtherReadAt] = useState(null);
  const scrollRef = useRef(null);
  const stickToBottom = useRef(true);

  const info = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => getConversation({ data: { conversationId } }),
  });
  useEffect(() => { if (info.data) setOtherReadAt(info.data.otherLastReadAt); }, [info.data]);

  const read = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      await markRead({ data: { conversationId } });
      queryClient.invalidateQueries({ queryKey: conversationsKey });
    } catch { /* non-critical */ }
  }, [conversationId, queryClient]);

  const loadLatest = useCallback(async () => {
    try {
      const res = await getMessages({ data: { conversationId } });
      setMe(res.me);
      setMessages((cur) => mergeMessages(cur, res.messages));
      setHasMore((h) => (cur => cur)(h) || res.hasMore);
      setError("");
      read();
    } catch (err) {
      setError(err?.message || "Could not load messages.");
    } finally {
      setLoading(false);
    }
  }, [conversationId, read]);

  // Fetch persisted messages, then subscribe; every (re)subscribe refetches to recover missed messages.
  useEffect(() => {
    setMessages([]); setLoading(true); stickToBottom.current = true;
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new;
          setMessages((cur) => mergeMessages(cur, [{ id: m.id, sender_id: m.sender_id, content: m.content, created_at: m.created_at }]));
          read();
        })
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversation_members", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          if (payload.new.user_id !== me) setOtherReadAt(payload.new.last_read_at);
        })
      .subscribe((status) => { if (status === "SUBSCRIBED") loadLatest(); });
    loadLatest();
    const onVisible = () => document.visibilityState === "visible" && read();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function loadOlder() {
    const oldest = messages.find((m) => !m.pending);
    if (!oldest) return;
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    stickToBottom.current = false;
    setLoadingOlder(true);
    try {
      const res = await getMessages({ data: { conversationId, before: oldest.created_at } });
      setMessages((cur) => mergeMessages(cur, res.messages));
      setHasMore(res.hasMore);
      requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevHeight; });
    } catch (err) {
      setError(err?.message || "Could not load older messages.");
    } finally {
      setLoadingOlder(false);
    }
  }

  async function deliver(tempId, content) {
    setMessages((cur) => cur.map((m) => (m.id === tempId ? { ...m, failed: false } : m)));
    try {
      const saved = await sendMessage({ data: { conversationId, content } });
      setMessages((cur) => mergeMessages(cur.filter((m) => m.id !== tempId), [saved]));
      queryClient.invalidateQueries({ queryKey: conversationsKey });
    } catch {
      setMessages((cur) => cur.map((m) => (m.id === tempId ? { ...m, failed: true } : m)));
    }
  }

  function submit(e) {
    e?.preventDefault();
    const content = draft.trim();
    if (!content || content.length > MESSAGE_MAX) return;
    const tempId = `tmp-${crypto.randomUUID()}`;
    stickToBottom.current = true;
    setMessages((cur) => [...cur, { id: tempId, sender_id: me, content, created_at: "9999", pending: true }]);
    setDraft("");
    deliver(tempId, content);
  }

  const lastMineRead = [...messages].reverse().find((m) => m.sender_id === me && !m.pending);

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-background/90 px-3 py-3 backdrop-blur">
        <button type="button" onClick={onBack} aria-label="Back to messages" className="rounded-full p-1 hover:bg-muted">
          <ArrowLeft className="size-5" />
        </button>
        <Avatar name={info.data?.otherName} size="size-9" />
        <p className="min-w-0 flex-1 truncate font-semibold">{info.data?.otherName || "…"}</p>
      </header>

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden px-3 py-4"
      >
        {hasMore && (
          <div className="text-center">
            <Button className="btn-ghost h-8 text-xs" disabled={loadingOlder} onClick={loadOlder}>
              {loadingOlder ? "Loading…" : "Load older messages"}
            </Button>
          </div>
        )}
        {loading && <p className="text-center text-sm text-muted-foreground">Loading messages…</p>}
        {!loading && messages.length === 0 && !error && (
          <p className="pt-10 text-center text-sm text-muted-foreground">No messages yet. Say hi 👋</p>
        )}
        {error && (
          <div role="alert" className="text-center text-sm text-destructive">
            {error} <button className="underline" onClick={loadLatest}>Retry</button>
          </div>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === me;
          const isRead = mine && !m.pending && otherReadAt && otherReadAt >= m.created_at;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                  mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground"
                } ${m.failed ? "opacity-60" : ""}`}
              >
                {m.content}
                <span className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {m.pending ? (m.failed ? "Not sent" : "Sending…") : shortTime(m.created_at)}
                  {mine && !m.pending && (isRead ? <CheckCheck aria-label="Read" className="size-3" /> : <Check aria-label="Sent" className="size-3" />)}
                </span>
              </div>
              {m.failed && (
                <button type="button" onClick={() => deliver(m.id, m.content)} aria-label="Retry sending" className="ml-1 self-center text-destructive">
                  <RotateCcw className="size-4" />
                </button>
              )}
            </div>
          );
        })}
        {lastMineRead && otherReadAt && otherReadAt >= lastMineRead.created_at && (
          <p className="text-right text-[10px] text-muted-foreground">Seen</p>
        )}
      </div>

      <form onSubmit={submit} className="flex shrink-0 items-end gap-2 border-t border-border bg-background p-2 pb-[calc(0.5rem+50px+env(safe-area-inset-bottom))]">
        <textarea
          value={draft}
          rows={1}
          maxLength={MESSAGE_MAX}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
          }}
          placeholder="Message"
          aria-label="Message"
          className="field max-h-32 min-h-11 flex-1 resize-none"
        />
        <Button type="submit" className="btn-primary size-11 shrink-0 p-0" disabled={!draft.trim() || !me} aria-label="Send">
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}

export default function Messages({ conversationId, onOpen, onBack }) {
  if (conversationId) return <Chat conversationId={conversationId} onBack={onBack} />;
  return <Inbox onOpen={onOpen} />;
}
