import { useEffect, useState } from "react";
import LiveKitCall from "./LiveKitCall";
import { Button } from "./ui/button";

export function sanitizeRoom(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

const WORDS = ["violet", "nebula", "echo", "pulse", "orbit", "ember", "drift", "lumen", "aurora", "comet"];
function randomRoom() {
  const bytes = new Uint32Array(2);
  crypto.getRandomValues(bytes);
  const w1 = WORDS[bytes[0] % WORDS.length];
  const w2 = WORDS[bytes[1] % WORDS.length];
  const id = Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 8);
  return `VibeLive-${w1}-${w2}-${id}`;
}

function roomLink(room, displayName) {
  const params = new URLSearchParams();
  params.set("room", room);
  const n = String(displayName || "").trim();
  if (n) params.set("name", n);
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

export default function VibeLive() {
  const [roomInput, setRoomInput] = useState("");
  const [name, setName] = useState("");
  const [activeRoom, setActiveRoom] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const [fromLink, setFromLink] = useState(false);

  // Prefill room (and display name) from a shared link; never generate a new room
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("room");
    if (r) {
      setRoomInput(sanitizeRoom(r));
      setFromLink(true);
    }
    const n = params.get("name");
    if (n) setName(n.slice(0, 40));
  }, []);

  function start(e) {
    e.preventDefault();
    const clean = sanitizeRoom(roomInput);
    if (!clean) return setError("Please enter a room name or generate one.");
    if (!name.trim()) return setError("Please enter your display name.");
    setRoomInput(clean);
    const params = new URLSearchParams();
    params.set("room", clean);
    params.set("name", name.trim());
    window.history.replaceState(null, "", `?${params.toString()}`);
    setActiveRoom(clean);
  }

  function leave() {
    setActiveRoom(null);
  }

  const [manualLink, setManualLink] = useState("");

  async function copyLink() {
    const room = activeRoom || sanitizeRoom(roomInput);
    if (!room) return;
    const link = roomLink(room, name);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setManualLink("");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked: show the link in a selectable field instead
      setManualLink(link);
    }
  }

  if (activeRoom) {
    return (
      <main className="flex min-h-[100dvh] flex-col bg-background">
        <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <span className="font-display text-lg font-bold text-primary">VibeLive</span>
          <span className="min-w-0 flex-1 truncate rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
            {activeRoom}
          </span>
          <Button onClick={copyLink} className="btn-ghost">{copied ? "Copied!" : "Copy link"}</Button>
          <Button onClick={leave} className="btn-danger">Leave Call</Button>
          {manualLink && <input aria-label="Room link" readOnly value={manualLink} onFocus={(e) => e.target.select()} className="field w-full text-xs" />}
        </header>
        <div className="relative flex-1 p-2 sm:p-4">
          <LiveKitCall roomName={activeRoom} displayName={name.trim()} />
        </div>
      </main>
    );
  }

  return (
    <main className="glow-bg flex min-h-[100dvh] items-center justify-center px-5 py-10">
      <form onSubmit={start} className="w-full max-w-md space-y-6 rounded-3xl border border-border bg-card/80 p-6 shadow-glow backdrop-blur sm:p-8">
        <div className="space-y-2 text-center">
          <h1 className="font-display text-4xl font-bold tracking-tight">
            Vibe<span className="text-primary">Live</span>
          </h1>
          <p className="text-sm text-muted-foreground">Start a video call and share the link.</p>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium">Room name</span>
          <div className="flex gap-2">
            <input
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              placeholder="e.g. team-standup-x7k2"
              className="field flex-1"
            />
            <Button type="button" onClick={() => setRoomInput(randomRoom())} className="btn-ghost shrink-0">
              Random
            </Button>
          </div>
          {roomInput && roomInput !== sanitizeRoom(roomInput) && (
            <span className="text-xs text-muted-foreground">Will be used as: {sanitizeRoom(roomInput)}</span>
          )}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium">Display name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={40} className="field w-full" />
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="btn-primary w-full py-3 text-base">
          {fromLink ? "Join Existing Room" : "Start Video Call"}
        </Button>
        <Button type="button" onClick={copyLink} disabled={!sanitizeRoom(roomInput)} className="btn-ghost w-full disabled:opacity-40">
          {copied ? "Link copied!" : "Copy room link"}
        </Button>
        {manualLink && (
          <label className="block space-y-2">
            <span className="text-xs text-muted-foreground">Copy this link manually:</span>
            <input readOnly value={manualLink} onFocus={(e) => e.target.select()} className="field w-full text-xs" />
          </label>
        )}
        <p className="text-center text-xs text-muted-foreground">LiveKit prototype only — development tokens are not secure for production.</p>
      </form>
    </main>
  );
}
