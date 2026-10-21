import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Every function runs as the signed-in user; database rules enforce membership.
const uuid = z.string().uuid();
export const MESSAGE_MAX = 4000;
export const PAGE_SIZE = 30;

function fail(error, message) {
  console.error("messaging:", error?.message);
  throw new Error(message);
}

export const searchUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ query: z.string().trim().min(2).max(40) }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase.rpc("search_profiles", { _query: data.query });
    if (error) fail(error, "Search failed. Please try again.");
    return (rows ?? []).map((r) => ({ id: r.id, displayName: r.display_name }));
  });

export const startConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: uuid }).parse(input))
  .handler(async ({ context, data }) => {
    if (data.userId === context.userId) throw new Error("You can't message yourself.");
    const { data: id, error } = await context.supabase.rpc("start_direct_conversation", { _other_user: data.userId });
    if (error || !id) fail(error, "Could not open this conversation.");
    return { id };
  });

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase.rpc("list_conversations");
    if (error) fail(error, "Could not load your messages.");
    return (rows ?? []).map((r) => ({
      id: r.id,
      otherUserId: r.other_user_id,
      otherName: r.other_display_name || "VibeLive user",
      lastMessage: r.last_message,
      lastMessageMine: r.last_message_sender === context.userId,
      lastMessageAt: r.last_message_at,
      unread: Number(r.unread_count) || 0,
      otherLastReadAt: r.other_last_read_at,
    }));
  });

export const getMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ conversationId: uuid, before: z.string().datetime({ offset: true }).optional() }).parse(input)
  )
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("messages")
      .select("id, sender_id, content, created_at")
      .eq("conversation_id", data.conversationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE_SIZE + 1);
    if (data.before) q = q.lt("created_at", data.before);
    const { data: rows, error } = await q;
    if (error) fail(error, "Could not load messages.");
    const page = (rows ?? []).slice(0, PAGE_SIZE);
    return { messages: page.reverse(), hasMore: (rows ?? []).length > PAGE_SIZE, me: context.userId };
  });

export const getConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ conversationId: uuid }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: members, error } = await context.supabase
      .from("conversation_members")
      .select("user_id, last_read_at")
      .eq("conversation_id", data.conversationId);
    if (error) fail(error, "Could not load this conversation.");
    const other = (members ?? []).find((m) => m.user_id !== context.userId);
    if (!other) throw new Error("Conversation not found.");
    const { data: list } = await context.supabase.rpc("list_conversations");
    const row = (list ?? []).find((r) => r.id === data.conversationId);
    return { otherUserId: other.user_id, otherName: row?.other_display_name || "VibeLive user", otherLastReadAt: other.last_read_at };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ conversationId: uuid, content: z.string().trim().min(1).max(MESSAGE_MAX) }).parse(input)
  )
  .handler(async ({ context, data }) => {
    // sender_id comes from the verified session, never from the client.
    const { data: row, error } = await context.supabase
      .from("messages")
      .insert({ conversation_id: data.conversationId, sender_id: context.userId, content: data.content })
      .select("id, sender_id, content, created_at")
      .single();
    if (error) fail(error, "Message not sent.");
    return row;
  });

export const markRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ conversationId: uuid }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("mark_conversation_read", { _conversation_id: data.conversationId });
    if (error) fail(error, "Could not update read status.");
    return { ok: true };
  });
