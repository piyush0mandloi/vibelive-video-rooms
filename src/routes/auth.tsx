import { createFileRoute } from "@tanstack/react-router";
import AuthPage from "@/components/AuthPage";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Sign in — VibeLive" },
    { name: "description", content: "Sign in or create your VibeLive account." },
    { property: "og:title", content: "Sign in — VibeLive" },
    { property: "og:description", content: "Sign in or create your VibeLive account." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: AuthPage,
});