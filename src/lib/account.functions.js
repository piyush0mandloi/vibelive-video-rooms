import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: auth, error: authError } = await context.supabase.auth.getUser();
    if (authError || !auth.user) throw new Error("Please sign in again.");
    const { data: profile, error } = await context.supabase.from("profiles").select("display_name").eq("id", context.userId).single();
    if (error) throw new Error("Your profile could not be loaded. Please try again.");
    return { email: auth.user.email, displayName: profile.display_name };
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ displayName: z.string().trim().max(40) }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("profiles").update({ display_name: data.displayName }).eq("id", context.userId);
    if (error) throw new Error("Your profile could not be saved. Please try again.");
    return { displayName: data.displayName };
  });