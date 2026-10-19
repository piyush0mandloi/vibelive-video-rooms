import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAccountAuth } from "./AccountAuth";
import { Button } from "./ui/button";

export default function AuthPage() {
  const { user, loading, error: sessionError } = useAccountAuth();
  const navigate = useNavigate();
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => { if (user) void navigate({ to: "/account", replace: true }); }, [user, navigate]);
  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const { data, error: authError } = signup
        ? await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin, data: { display_name: displayName.trim() } } })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) throw authError;
      setPassword("");
      if (signup && !data.session) setNotice("Check your email to confirm your account, then sign in.");
      else await navigate({ to: "/account", replace: true });
    } catch (err) { setError(err.message || "Unable to sign in. Please try again."); }
    finally { setBusy(false); }
  }
  return <main className="glow-bg flex min-h-[100dvh] items-center justify-center px-5 py-10">
    <form onSubmit={submit} className="w-full max-w-md space-y-6 rounded-3xl border border-border bg-card/80 p-6 shadow-glow sm:p-8">
      <h1 className="text-center font-display text-3xl font-bold">Vibe<span className="text-primary">Live</span></h1>
      <h2 className="text-center text-xl font-semibold">{signup ? "Create account" : "Sign in"}</h2>
      {signup && <label className="block space-y-2"><span>Display name</span><input className="field w-full" value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={40} required autoComplete="nickname" /></label>}
      <label className="block space-y-2"><span>Email</span><input className="field w-full" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label>
      <label className="block space-y-2"><span>Password</span><input className="field w-full" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={signup ? "new-password" : "current-password"} minLength={signup ? 6 : undefined} required /></label>
      {(error || sessionError) && <p role="alert" className="text-sm text-destructive">{error || sessionError}</p>}
      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
      <Button className="btn-primary w-full" disabled={busy || loading}>{busy ? "Please wait…" : loading ? "Checking session…" : signup ? "Create account" : "Sign in"}</Button>
      <Button type="button" className="btn-ghost w-full" disabled={busy} onClick={() => { setSignup(!signup); setError(""); setNotice(""); }}>{signup ? "Already have an account? Sign in" : "Create an account"}</Button>
      <Button asChild variant="link" className="w-full"><Link to="/">Continue as guest</Link></Button>
    </form>
  </main>;
}