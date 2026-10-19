import { createFileRoute } from "@tanstack/react-router";
import VibeLive from "../components/VibeLive.jsx";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VibeLive — Instant video calls" },
      { name: "description", content: "Start a video call in seconds and share the room link." },
      { property: "og:title", content: "VibeLive — Instant video calls" },
      { property: "og:description", content: "Start a video call in seconds and share the room link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VibeLive,
});
