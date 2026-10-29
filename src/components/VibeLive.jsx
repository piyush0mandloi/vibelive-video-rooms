import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus, Copy, LogOut, Trash2, Check, Video, User } from "lucide-react";
import { motion } from "framer-motion";

import LiveKitCall from "./LiveKitCall";
import { Button } from "./ui/button";
import { useAccountAuth } from "../features/auth/AccountAuth";
import { accountOptions } from "../features/account/AccountPage";
import { createRoom, listRooms, deleteRoom } from "@/lib/room.functions";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "./BottomNav";
import Messages, { conversationsKey, useInboxRealtime } from "../features/messaging/Messages";
import { listConversations } from "@/lib/messaging.functions";

function AppShell({ children }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-neutral-900 sm:p-4">
      <div className="relative h-[100dvh] w-full max-w-[390px] transform-gpu overflow-hidden bg-background text-foreground sm:h-[min(calc(100dvh-2rem),844px)] sm:rounded-[2.5rem] sm:border sm:border-white/10 sm:shadow-2xl">
        {children}
      </div>
    </div>
  );
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// "Piyush Kumar Sharma" -> "PS", "Piyush" -> "P", "" -> ""
function getInitials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";

  const first = [...parts[0]][0];
  const last = parts.length > 1 ? [...parts[parts.length - 1]][0] : "";

  return (first + last).toUpperCase();
}

export default function VibeLive() {
  const { user, loading } = useAccountAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState("rooms");
  const [activeRoom, setActiveRoom] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [createdRoomId, setCreatedRoomId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [openConversation, setOpenConversation] = useState(null);

  const conversationsQuery = useQuery({
    queryKey: conversationsKey,
    queryFn: () => listConversations(),
    enabled: !!user,
  });
  const unreadTotal = (conversationsQuery.data ?? []).reduce((n, c) => n + c.unread, 0);
  useInboxRealtime(!!user);

  const accountQuery = useQuery({
    ...accountOptions,
    enabled: !!user,
  });

  const roomsQuery = useQuery({
    queryKey: ["rooms"],
    queryFn: () => listRooms(),
    enabled: !!user,
  });

  const displayName = accountQuery.data?.displayName?.trim() || "";
  const initials = getInitials(displayName);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get("room");

    if (roomId && user && !loading) {
      setActiveRoom(roomId);
    }
  }, [user, loading]);

  function resetMessages() {
    setError("");
    setNotice("");
    setCreatedRoomId(null);
    setCopied(false);
    setConfirmDeleteId(null);
  }

  function handleTabChange(nextTab) {
    setTab(nextTab);
    setOpenConversation(null);
    resetMessages();
  }

  async function requireProfile() {
    if (loading) return false;

    if (!user) {
      window.location.assign("/auth");
      return false;
    }

    if (accountQuery.isLoading) {
      setError("Loading your profile. Please try again.");
      return false;
    }

    if (accountQuery.isError) {
      setError("Could not load your profile. Please refresh and try again.");
      return false;
    }

    if (!displayName) {
      setError("Please set your display name in your account first.");
      setTab("profile");
      return false;
    }

    return true;
  }

  async function handleCreateRoom() {
    resetMessages();

    if (!(await requireProfile())) return;

    setBusy(true);
    try {
      const room = await createRoom({ data: {} });

      // Put the new room at the top of the list immediately.
      queryClient.setQueryData(["rooms"], (old) => [
        room,
        ...(old ?? []).filter((r) => r.id !== room.id),
      ]);

      setCreatedRoomId(room.id);

      // Background refetch to stay in sync with the database.
      void queryClient.invalidateQueries({ queryKey: ["rooms"] });
    } catch (err) {
      setError(err?.message || "Could not create the room.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyId(roomId) {
    const ok = await copyText(roomId);
    if (!ok) {
      setNotice(`Copy this ID: ${roomId}`);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDeleteRoom(roomId) {
    setError("");
    setNotice("");
    setDeletingId(roomId);

    try {
      await deleteRoom({ data: { roomId } });
      await queryClient.invalidateQueries({ queryKey: ["rooms"] });

      if (createdRoomId === roomId) setCreatedRoomId(null);

      const current = new URLSearchParams(window.location.search).get("room");
      if (current === roomId) window.history.replaceState({}, "", "/");

      setConfirmDeleteId(null);
      setNotice("Room deleted permanently.");
    } catch (err) {
      setError(err?.message || "Could not delete the room.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleJoinRoom(roomId) {
    setError("");
    setNotice("");

    if (!(await requireProfile())) return;

    setCreatedRoomId(null);
    setCopied(false);
    window.history.pushState({}, "", `/?room=${encodeURIComponent(roomId)}`);
    setActiveRoom(roomId);
  }

  function leaveRoom() {
    setActiveRoom(null);
    window.history.pushState({}, "", "/");
  }

  async function shareRoom(roomId) {
    const link = `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Join my VibeLive room",
          url: link,
        });
      } else {
        await navigator.clipboard.writeText(link);
        setNotice("Room link copied!");
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        setNotice(`Copy this link: ${link}`);
      }
    }
  }

  async function logout() {
    setError("");
    await queryClient.cancelQueries();
    queryClient.clear();
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setError("Could not log out. Please try again.");
      return;
    }

    await supabase.removeAllChannels();
    // Stay on Profile; the auth context flips to signed-out and shows the prompt.
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center text-muted-foreground">
          Checking your account…
        </div>
      </AppShell>
    );
  }

  if (activeRoom) {
    return (
      <AppShell>
        <div className="flex h-full flex-col">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">VibeLive room</p>
              <p className="truncate text-sm font-medium">{activeRoom}</p>
            </div>

            <Button className="btn-ghost" onClick={() => shareRoom(activeRoom)}>
              <Copy className="mr-1 size-4" />
              Share
            </Button>
          </header>

          <section className="min-h-0 flex-1 overflow-hidden p-2">
            <LiveKitCall roomId={activeRoom} onEndCall={leaveRoom} />
          </section>

          <BottomNav activeTab={tab} onTabChange={handleTabChange} unread={unreadTotal} />
        </div>
      </AppShell>
    );
  }

  if (tab === "messages" && openConversation && user) {
    return (
      <AppShell>
        <Messages conversationId={openConversation} onBack={() => setOpenConversation(null)} />
        <BottomNav activeTab={tab} onTabChange={handleTabChange} unread={unreadTotal} />
      </AppShell>
    );
  }

  const sharedRoomId =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("room")
      : null;

  return (
    <AppShell>
      <div className="glow-bg h-full overflow-y-auto overscroll-contain pb-24 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/90 px-5 py-4 backdrop-blur">
          <Link to="/" className="font-display text-xl font-bold">
            Vibe<span className="text-primary">Live</span>
          </Link>

          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => handleTabChange("profile")}
            aria-label="Open profile"
            title="Profile"
            className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary ring-2 transition-colors ${
              tab === "profile" ? "ring-primary" : "ring-transparent"
            }`}
          >
            {initials || <User className="size-5" />}
          </motion.button>
        </header>

        <section className="w-full space-y-5 px-4 py-6">
          {tab === "rooms" ? (
            <>
              <div>
                <h1 className="text-2xl font-bold">Your rooms</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a room or join one using its shared link.
                </p>
              </div>

              <Button
                className="btn-primary h-12 w-full"
                onClick={handleCreateRoom}
                disabled={busy}
              >
                <Plus className="mr-2 size-5" />
                {busy ? "Creating room…" : "Create a room"}
              </Button>

              {/* Room created: Join + Copy ID + Share */}
              {createdRoomId && (
                <article className="space-y-3 rounded-2xl border border-primary/40 bg-card p-4">
                  <p className="text-sm font-medium">Room created successfully</p>
                  <p className="break-all text-xs text-muted-foreground">
                    ID: {createdRoomId}
                  </p>

                  <Button
                    className="btn-primary h-11 w-full"
                    onClick={() => handleJoinRoom(createdRoomId)}
                  >
                    <Video className="mr-2 size-4" />
                    Join room
                  </Button>

                  <div className="flex gap-2">
                    <Button
                      className="btn-ghost flex-1"
                      onClick={() => handleCopyId(createdRoomId)}
                    >
                      {copied ? (
                        <Check className="mr-1 size-4" />
                      ) : (
                        <Copy className="mr-1 size-4" />
                      )}
                      {copied ? "Copied!" : "Copy ID"}
                    </Button>
                    <Button
                      className="btn-ghost flex-1"
                      onClick={() => shareRoom(createdRoomId)}
                    >
                      Share
                    </Button>
                  </div>
                </article>
              )}

              {notice && (
                <p className="break-all rounded-xl border border-border p-3 text-sm">
                  {notice}
                </p>
              )}

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <div className="space-y-3">
                <h2 className="font-semibold">Previously created rooms</h2>

                {roomsQuery.isLoading && (
                  <p className="text-sm text-muted-foreground">Loading rooms…</p>
                )}

                {roomsQuery.isError && (
                  <p role="alert" className="text-sm text-destructive">
                    Could not load your rooms.
                  </p>
                )}

                {roomsQuery.data?.length === 0 && (
                  <p className="rounded-2xl border border-border p-4 text-sm text-muted-foreground">
                    No rooms yet. Create your first room above.
                  </p>
                )}

                {roomsQuery.data?.map((room) => {
                  const confirming = confirmDeleteId === room.id;
                  const deleting = deletingId === room.id;
                  const isNew = createdRoomId === room.id;

                  return (
                    <article
                      key={room.id}
                      className={`space-y-3 rounded-2xl border bg-card p-4 ${
                        isNew ? "border-primary/50" : "border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="break-all text-sm font-medium">{room.id}</p>
                        {isNew && (
                          <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            New
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Status: {room.status}
                      </p>

                      {confirming ? (
                        <div className="space-y-2 rounded-xl border border-destructive/40 p-3">
                          <p className="text-sm text-destructive">
                            Delete permanently?
                          </p>
                          <div className="flex gap-2">
                            <Button
                              className="btn-danger flex-1"
                              disabled={deleting}
                              onClick={() => handleDeleteRoom(room.id)}
                            >
                              {deleting ? "Deleting…" : "Yes, delete"}
                            </Button>
                            <Button
                              className="btn-ghost flex-1"
                              disabled={deleting}
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            className="btn-primary flex-1"
                            disabled={room.status !== "active"}
                            onClick={() => handleJoinRoom(room.id)}
                          >
                            Join room
                          </Button>

                          <Button
                            className="btn-ghost"
                            onClick={() => shareRoom(room.id)}
                            aria-label="Share room"
                          >
                            <Copy className="size-4" />
                          </Button>

                          <Button
                            className="btn-danger"
                            onClick={() => setConfirmDeleteId(room.id)}
                            aria-label="Delete room"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              {/* Only for links opened from outside, never for a room just created */}
              {sharedRoomId && sharedRoomId !== createdRoomId && (
                <article className="rounded-2xl border border-primary/30 bg-card p-4">
                  <p className="mb-2 text-sm font-medium">Shared room invitation</p>
                  <p className="mb-3 break-all text-xs text-muted-foreground">
                    {sharedRoomId}
                  </p>
                  <Button
                    className="btn-primary w-full"
                    onClick={() => handleJoinRoom(sharedRoomId)}
                  >
                    Join shared room
                  </Button>
                </article>
              )}
            </>
          ) : tab === "messages" ? (
            user ? (
              <Messages onOpen={setOpenConversation} />
            ) : (
              <p className="text-sm text-muted-foreground">
                <Link to="/auth" className="text-primary underline">Sign in</Link> to use messages.
              </p>
            )
          ) : (
            <>
              <div>
                <h1 className="text-2xl font-bold">Your profile</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your saved account information.
                </p>
              </div>

              {!user ? (
                <p className="text-sm text-muted-foreground">
                  <Link to="/auth" className="text-primary underline">Sign in</Link> to view your profile.
                </p>
              ) : accountQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading profile…</p>
              ) : accountQuery.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  Could not load your profile.
                </p>
              ) : (
                <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
                  <div>
                    <p className="text-xs text-muted-foreground">Display name</p>
                    <p className="mt-1 font-semibold">
                      {displayName || "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="mt-1 break-all">{accountQuery.data?.email}</p>
                  </div>
                  <Button asChild className="btn-ghost w-full">
                    <Link to="/account">Edit profile</Link>
                  </Button>
                  <Button className="btn-danger w-full" onClick={logout}>
                    <LogOut className="mr-2 size-4" />
                    Log out
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <BottomNav activeTab={tab} onTabChange={handleTabChange} unread={unreadTotal} />
    </AppShell>
  );
}