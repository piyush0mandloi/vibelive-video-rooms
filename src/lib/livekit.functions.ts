
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AccessToken } from "livekit-server-sdk";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const joinRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ roomId: z.string().uuid() }).parse(input)
  )
  .handler(async ({ context, data }) => {
    const livekitUrl = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!livekitUrl || !apiKey || !apiSecret) {
      throw new Error("LiveKit server configuration is missing.");
    }

    // Resolve the shared UUID to an actual room record.
    const { data: rooms, error: roomError } = await (context.supabase as any).rpc(
  "get_joinable_room",
  { _room_id: data.roomId }
);

const room = Array.isArray(rooms) ? rooms[0] : null;

    if (roomError) {
      console.error("Room lookup failed:", roomError.message);
      throw new Error("Could not validate this room.");
    }

    if (!room || room.status !== "active") {
      throw new Error("This room does not exist or has ended.");
    }

    // The participant name always comes from the saved profile.
    const { data: profile, error: profileError } = await context.supabase
      .from("profiles")
      .select("display_name")
      .eq("id", context.userId)
      .single();

    if (profileError || !profile?.display_name?.trim()) {
      throw new Error("Please set your display name in your profile first.");
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity: context.userId,
      name: profile.display_name.trim(),
      ttl: "10m",
    });

    token.addGrant({
      roomJoin: true,
      room: room.room_name,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const participantToken = await token.toJwt();

    return {
      serverUrl: livekitUrl,
      participantToken,
      roomId: room.id,
      displayName: profile.display_name.trim(),
    };
  });
