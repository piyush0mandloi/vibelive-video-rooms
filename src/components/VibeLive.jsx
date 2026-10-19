import { useEffect, useRef, useState } from "react";

const JITSI_DOMAIN = "meet.jit.si";
const SCRIPT_SRC = "https://meet.jit.si/external_api.js";

let scriptPromise = null;
function loadJitsiScript() {
  if (typeof window === "undefined") return Promise.reject(new Error("No browser"));
  if (window.JitsiMeetExternalAPI) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => (window.JitsiMeetExternalAPI ? resolve() : reject(new Error("Jitsi API unavailable")));
    s.onerror = () => {
      scriptPromise = null;
      s.remove();
      reject(new Error("Could not load the Jitsi Meet script. Check your connection or ad blocker."));
    };
    document.body.appendChild(s);
  });
  return scriptPromise;
}

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
  const [status, setStatus] = useState("idle"); // idle | loading | joined | error
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const containerRef = useRef(null);
  const apiRef = useRef(null);

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

  function disposeApi() {
    const api = apiRef.current;
    if (api) {
      try {
        api.removeAllListeners?.();
        api.dispose();
      } catch (e) {
        /* ignore */
      }
      apiRef.current = null;
    }
  }

  // Initialize Jitsi once the room is set and container is mounted
  useEffect(() => {
    if (!activeRoom) return;
    let cancelled = false;
    setStatus("loading");
    setError("");

    loadJitsiScript()
      .then(() => {
        if (cancelled || !containerRef.current || apiRef.current) return;
        const api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
          roomName: activeRoom,
          parentNode: containerRef.current,
          width: "100%",
          height: "100%",
          userInfo: { displayName: name.trim() },
          configOverwrite: { prejoinPageEnabled: true },
        });
        apiRef.current = api;
        api.addListener("videoConferenceJoined", () => setStatus("joined"));
        api.addListener("readyToClose", () => leave());
        api.addListener("errorOccurred", (e) => {
          if (e?.error === "conference.connectionError" || e?.error === "connection.passwordRequired") {
            setStatus("error");
            setError("This room could not be joined. The public meet.jit.si service may require a moderator for this room.");
          }
        });
        // Iframe loaded: hide our spinner (Jitsi shows its own pre-join)
        setTimeout(() => !cancelled && setStatus((s) => (s === "loading" ? "joined" : s)), 2500);
      })
      .catch((e) => {
        if (cancelled) return;
        setStatus("error");
        setError(e.message || "Failed to start the call.");
      });

    return () => {
      cancelled = true;
      disposeApi();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom]);

  function start(e) {
    e.preventDefault();
    const clean = sanitizeRoom(roomInput);
    if (!clean) return setError("Please enter a room name or generate one.");
    if (!name.trim()) return setError("Please enter your display name.");
    setRoomInput(clean);
    window.history.replaceState(null, "", `?room=${encodeURIComponent(clean)}`);
    setActiveRoom(clean);
  }

  function leave() {
    disposeApi();
    setActiveRoom(null);
    setStatus("idle");
  }

  async function copyLink() {
    const room = activeRoom || sanitizeRoom(roomInput);
    if (!room) return;
    try {
      await navigator.clipboard.writeText(roomLink(room));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this link:", roomLink(room));
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
          <button onClick={copyLink} className="btn-ghost">{copied ? "Copied!" : "Copy link"}</button>
          <button onClick={leave} className="btn-danger">Leave Call</button>
        </header>
        <div className="relative flex-1 p-2 sm:p-4">
          <div ref={containerRef} className="h-[calc(100dvh-90px)] min-h-[480px] w-full overflow-hidden rounded-2xl border border-border bg-card" />
          {status === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-secondary border-t-primary" />
              Connecting to meeting…
            </div>
          )}
          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <p className="text-destructive">{error}</p>
              <button onClick={leave} className="btn-primary">Back</button>
            </div>
          )}
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
            <button type="button" onClick={() => setRoomInput(randomRoom())} className="btn-ghost shrink-0">
              Random
            </button>
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

        <button type="submit" className="btn-primary w-full py-3 text-base">Start Video Call</button>
        <button type="button" onClick={copyLink} disabled={!sanitizeRoom(roomInput)} className="btn-ghost w-full disabled:opacity-40">
          {copied ? "Link copied!" : "Copy room link"}
        </button>
        <p className="text-center text-xs text-muted-foreground">Powered by the public meet.jit.si service.</p>
      </form>
    </main>
  );
}
