
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .max(24)
    .refine(
      (value) => value === "" || /^[a-z0-9_]{3,24}$/.test(value),
      "Username must contain 3–24 lowercase letters, numbers, or underscores."
    ),
  bio: z.string().trim().max(160),
  website: z
    .string()
    .trim()
    .max(200)
    .refine((value) => {
      if (!value) return true;

      try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:";
      } catch {
        return false;
      }
    }, "Enter a valid website URL starting with https:// or http://"),
  avatarPath: z.string().max(512).nullable(),
});

export const getAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: auth, error: authError } =
      await context.supabase.auth.getUser();

    if (authError || !auth.user) {
      throw new Error("Please sign in again.");
    }

    const { data: profile, error } = await context.supabase
      .from("profiles")
      .select(
        "display_name, username, bio, website, avatar_path, created_at"
      )
      .eq("id", context.userId)
      .single();

    if (error || !profile) {
      throw new Error(
        "Your profile could not be loaded. Please try again."
      );
    }

    return {
      email: auth.user.email ?? "",
      displayName: profile.display_name ?? "",
      username: profile.username ?? "",
      bio: profile.bio ?? "",
      website: profile.website ?? "",
      avatarPath: profile.avatar_path ?? null,
      createdAt: profile.created_at ?? null,
    };
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => profileSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({
        display_name: data.displayName,
        username: data.username || null,
        bio: data.bio,
        website: data.website,
        avatar_path: data.avatarPath,
      })
      .eq("id", context.userId);

    if (error) {
      if (error.code === "23505") {
        throw new Error(
          "This username is already taken. Please choose another."
        );
      }

      if (error.code === "23514") {
        throw new Error(
          "Some profile information is invalid. Please check your inputs."
        );
      }

      throw new Error(
        "Your profile could not be saved. Please try again."
      );
    }

    return {
      displayName: data.displayName,
      username: data.username,
      bio: data.bio,
      website: data.website,
      avatarPath: data.avatarPath,
    };
  });

  
export const getAccountSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: auth, error: authError } =
      await context.supabase.auth.getUser();

    if (authError || !auth.user) {
      throw new Error("Please sign in again.");
    }

    const { error: initError } = await context.supabase
      .from("account_settings")
      .upsert(
        { user_id: context.userId },
        { onConflict: "user_id", ignoreDuplicates: true }
      );

    if (initError) {
      throw new Error("Could not initialize account settings.");
    }

    const { data, error } = await context.supabase
      .from("account_settings")
      .select(
        "message_notifications_enabled, room_notifications_enabled, email_notifications_enabled, profile_discoverable"
      )
      .eq("user_id", context.userId)
      .single();

    if (error || !data) {
      throw new Error("Could not load account settings.");
    }

    return {
      messageNotificationsEnabled: data.message_notifications_enabled,
      roomNotificationsEnabled: data.room_notifications_enabled,
      emailNotificationsEnabled: data.email_notifications_enabled,
      profileDiscoverable: data.profile_discoverable,
    };
  });

export const saveAccountSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        messageNotificationsEnabled: z.boolean(),
        roomNotificationsEnabled: z.boolean(),
        emailNotificationsEnabled: z.boolean(),
        profileDiscoverable: z.boolean(),
      })
      .parse(input)
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("account_settings")
      .upsert(
        {
          user_id: context.userId,
          message_notifications_enabled: data.messageNotificationsEnabled,
          room_notifications_enabled: data.roomNotificationsEnabled,
          email_notifications_enabled: data.emailNotificationsEnabled,
          profile_discoverable: data.profileDiscoverable,
        },
        { onConflict: "user_id" }
      );

    if (error) {
      throw new Error("Your account settings could not be saved.");
    }

    return data;
  });
