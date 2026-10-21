import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getAccount, saveProfile } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";

export const accountOptions = { queryKey: ["account"], queryFn: () => getAccount() };

export default function AccountPage() {
  const { data } = useSuspenseQuery(accountOptions);
  const [displayName, setDisplayName] = useState(data.displayName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const save = useServerFn(saveProfile);
  async function logout() {
    setBusy(true); setError("");
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      const { error: authError } = await supabase.auth.signOut();
      if (authError) throw authError;
      await navigate({ to: "/auth", replace: true });
    } catch (err) { setError(err.message || "Unable to sign out. Please try again."); setBusy(false); }
  }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try { await save({ data: { displayName } }); await queryClient.invalidateQueries({ queryKey: ["account"] }); setNotice("Profile saved."); }
    catch (err) { setError(err.message || "Unable to save profile."); }
    finally { setBusy(false); }
  }
  return <main className="glow-bg flex min-h-[100dvh] items-center justify-center px-5 py-10"><section className="w-full max-w-md space-y-6">
    <h1 className="font-display text-3xl font-bold">Vibe<span className="text-primary">Live</span> account</h1>
    <p className="break-all text-muted-foreground">{data.email}</p>
    <form onSubmit={submit} className="space-y-3"><label className="block space-y-2"><span>Display name</span><input className="field w-full" value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={40} /></label><Button className="btn-primary" disabled={busy}>Save profile</Button></form>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    <div className="flex flex-wrap gap-3"><Button asChild className="btn-ghost"><Link to="/">Video rooms</Link></Button><Button onClick={logout} disabled={busy} className="btn-danger">{busy ? "Please wait…" : "Log out"}</Button></div>
  </section></main>;
}