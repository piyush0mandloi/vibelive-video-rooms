import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const AuthContext = createContext({ user: null, loading: true, error: "" });
export const useAccountAuth = () => useContext(AuthContext);

export function AccountAuthProvider({ children }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [state, setState] = useState({ user: null, loading: true, error: "" });
  useEffect(() => {
    let alive = true;
    let version = 0;
    async function verify() {
      const current = ++version;
      try {
        const { data, error } = await supabase.auth.getUser();
        if (alive && current === version) setState({ user: data.user, loading: false, error: error && error.name !== "AuthSessionMissingError" ? error.message : "" });
      } catch {
        if (alive && current === version) setState({ user: null, loading: false, error: "Account connection failed. Refresh to try again." });
      }
    }
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        version++;
        setState({ user: null, loading: false, error: "" });
        void router.invalidate();
      } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        // Run outside the Supabase callback to avoid locking other auth calls.
        setTimeout(() => { if (alive) { void verify(); void router.invalidate(); void queryClient.invalidateQueries(); } }, 0);
      }
    });
    void verify();
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, [router, queryClient]);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}