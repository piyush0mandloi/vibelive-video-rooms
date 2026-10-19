import { createFileRoute } from "@tanstack/react-router";
import AccountPage, { accountOptions } from "@/components/AccountPage";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [
    { title: "Your account — VibeLive" },
    { name: "description", content: "Manage your VibeLive profile and account." },
    { property: "og:title", content: "Your account — VibeLive" },
    { property: "og:description", content: "Manage your VibeLive profile and account." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(accountOptions),
  pendingComponent: () => <main className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Loading your account…</main>,
  component: AccountPage,
});