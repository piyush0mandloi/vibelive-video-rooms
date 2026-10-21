
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Your generated Database type currently lists profiles but not rooms.
// Replace this cast with regenerated Supabase types once available.
function roomsDb(client: unknown) {
  return (client as SupabaseClient<any>).from("rooms");
}

export const listRooms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await roomsDb(context.supabase)
      .select("id, room_name, status, created_at")
      .eq("created_by", context.userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("List rooms failed:", error.message);
      throw new Error("Could not load your rooms.");
    }

    return data ?? [];
  });

export const createRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({}).parse(input))
  .handler(async ({ context }) => {
    // Use the same UUID for the public room ID and LiveKit room name.
    const id = crypto.randomUUID();
    const roomName = `vibelive-${id}`;

    const { data, error } = await roomsDb(context.supabase)
      .insert({
        id,
        room_name: roomName,
        created_by: context.userId,
        status: "active",
      })
      .select("id, room_name, status, created_at")
      .single();

    if (error) {
      console.error("Create room failed:", error.message);
      throw new Error("Could not create the room. Please try again.");
    }

    return data;
  });


  export const deleteRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ roomId: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { data: deleted, error } = await roomsDb(context.supabase)
      .delete()
      .eq("id", data.roomId)
      .eq("created_by", context.userId)
      .select("id");

    if (error) {
      console.error("Delete room failed:", error.message);
      throw new Error("Could not delete the room. Please try again.");
    }

    if (!deleted || deleted.length === 0) {
      throw new Error("Room not found or you are not allowed to delete it.");
    }

    return { success: true };
  });