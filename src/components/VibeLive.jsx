import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {  Bell,
  ShieldCheck,
  AlertTriangle,
  Plus,
  Copy,
  LogOut,
  Trash2,
  Check,
  Video,
  User, } from "lucide-react";
import { motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";

import LiveKitCall from "./LiveKitCall";
import { Button } from "./ui/button";
import { useAccountAuth } from "../features/auth/AccountAuth";
import { accountOptions } from "../features/account/AccountPage";
import { createRoom, listRooms, deleteRoom } from "@/lib/room.functions";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "./BottomNav";
import Messages, { conversationsKey, useInboxRealtime } from "../features/messaging/Messages";
import { listConversations } from "@/lib/messaging.functions";
import {
  getAccountSettings,
  saveAccountSettings,
} from "@/lib/account.functions";


function AppShell({ children }) {
  return (
    <div className="flex min-h-screen min-h-[100dvh] w-full max-w-full items-center justify-center overflow-x-hidden bg-neutral-900 md:p-4">
      <div className="relative box-border h-screen h-[100dvh] w-full min-w-0 max-w-full transform-gpu overflow-hidden bg-background pt-[env(safe-area-inset-top)] text-foreground md:h-[min(calc(100dvh-2rem),900px)] md:max-w-[480px] md:rounded-[2rem] md:border md:border-white/10 md:shadow-2xl">
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

  const [settingsBusy, setSettingsBusy] = useState(false);
const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
const [deleteAccountPhrase, setDeleteAccountPhrase] = useState("");
const [deletingAccount, setDeletingAccount] = useState(false);

const saveSettings = useServerFn(saveAccountSettings);

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

  const accountSettingsQuery = useQuery({
  queryKey: ["account-settings"],
  queryFn: () => getAccountSettings(),
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

  
async function updateAccountSetting(setting, value) {
  if (settingsBusy || !accountSettingsQuery.data) return;

  setSettingsBusy(true);
  setError("");
  setNotice("");

  try {
    await saveSettings({
      data: {
        ...accountSettingsQuery.data,
        [setting]: value,
      },
    });

    await queryClient.invalidateQueries({
      queryKey: ["account-settings"],
    });

    setNotice("Your preference has been saved.");
  } catch (err) {
    setError(err?.message || "Could not save this preference.");
  } finally {
    setSettingsBusy(false);
  }
}

async function handleDeleteAccount() {
  if (deleteAccountPhrase.trim() !== "DELETE" || deletingAccount) {
    return;
  }

  setDeletingAccount(true);
  setError("");
  setNotice("");

  try {
    const { data, error: functionError } =
      await supabase.functions.invoke("delete-account", {
        body: { confirmation: "DELETE" },
      });

    if (functionError || !data?.success) {
      throw new Error(
        data?.error ||
          functionError?.message ||
          "Account deletion failed. Please try again."
      );
    }

    await queryClient.cancelQueries();
    await supabase.removeAllChannels();
    await supabase.auth.signOut({ scope: "local" });
    queryClient.clear();

    window.location.assign("/auth");
  } catch (err) {
    setError(err?.message || "Could not delete your account.");
    setDeletingAccount(false);
  }
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
    <div className="space-y-1">
      <h1 className="text-2xl font-bold">Your profile</h1>
      <p className="text-sm text-muted-foreground">
        Manage your identity, preferences, and account.
      </p>
    </div>

    {!user ? (
      <p className="text-sm text-muted-foreground">
        <Link to="/auth" className="text-primary underline">
          Sign in
        </Link>{" "}
        to view your profile and settings.
      </p>
    ) : accountQuery.isLoading ? (
      <p className="text-sm text-muted-foreground">Loading profile…</p>
    ) : accountQuery.isError ? (
      <p role="alert" className="text-sm text-destructive">
        Could not load your profile.
      </p>
    ) : (
      <>
        {/* Profile overview */}
        <section className="space-y-5 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-xl font-bold text-primary ring-1 ring-primary/30">
              {accountQuery.data?.avatarPath ? (
                <img
                  src={
                    supabase.storage
                      .from("vibelive-avatars")
                      .getPublicUrl(accountQuery.data.avatarPath).data.publicUrl
                  }
                  alt="Profile"
                  className="size-full object-cover"
                />
              ) : (
                initials || <User className="size-6" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="break-words text-lg font-semibold">
                {displayName || "Not set"}
              </h2>
              <p className="break-all text-sm text-muted-foreground">
                {accountQuery.data?.username
                  ? `@${accountQuery.data.username}`
                  : "VibeLive member"}
              </p>
            </div>
          </div>

          {accountQuery.data?.bio && (
            <p className="whitespace-pre-wrap break-words text-sm">
              {accountQuery.data.bio}
            </p>
          )}

          {accountQuery.data?.website && (
            <a
              href={accountQuery.data.website}
              target="_blank"
              rel="noreferrer"
              className="block break-all text-sm text-primary underline"
            >
              {accountQuery.data.website}
            </a>
          )}

          <div className="space-y-1 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">Email address</p>
            <p className="break-all text-sm">
              {accountQuery.data?.email || "Email unavailable"}
            </p>
          </div>

          <Button asChild className="btn-primary w-full">
            <Link to="/account">Edit profile</Link>
          </Button>
        </section>

        {/* Feedback */}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {notice && (
          <p role="status" className="text-sm text-muted-foreground">
            {notice}
          </p>
        )}

        {/* Notification preferences */}
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 size-5 text-primary" />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">Notifications</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Configure your preferences. Push and email delivery
                are not enabled yet.
              </p>
            </div>
          </div>

          {accountSettingsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading preferences…
            </p>
          ) : accountSettingsQuery.isError ? (
            <p role="alert" className="text-sm text-destructive">
              Could not load notification preferences.
            </p>
          ) : accountSettingsQuery.data ? (
            <div className="space-y-4">
              <label className="flex cursor-pointer items-center justify-between gap-4">
                <span>
                  <span className="block text-sm font-medium">
                    Private messages
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Preference for new direct messages
                  </span>
                </span>

                <input
                  type="checkbox"
                  className="size-5 shrink-0 accent-primary"
                  checked={
                    accountSettingsQuery.data.messageNotificationsEnabled
                  }
                  disabled={settingsBusy}
                  onChange={(event) =>
                    updateAccountSetting(
                      "messageNotificationsEnabled",
                      event.target.checked
                    )
                  }
                />
              </label>

              <label className="flex cursor-pointer items-center justify-between gap-4">
                <span>
                  <span className="block text-sm font-medium">
                    Room activity
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Preference for room-related updates
                  </span>
                </span>

                <input
                  type="checkbox"
                  className="size-5 shrink-0 accent-primary"
                  checked={
                    accountSettingsQuery.data.roomNotificationsEnabled
                  }
                  disabled={settingsBusy}
                  onChange={(event) =>
                    updateAccountSetting(
                      "roomNotificationsEnabled",
                      event.target.checked
                    )
                  }
                />
              </label>
            </div>
          ) : null}
        </section>

        {/* Account security */}
        <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 text-primary" />
            <div>
              <h2 className="font-semibold">Security & account</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage your signed-in VibeLive account.
              </p>
            </div>
          </div>

          <Button
            type="button"
            className="btn-ghost w-full"
            onClick={logout}
          >
            <LogOut className="mr-2 size-4" />
            Log out
          </Button>
        </section>

        {/* Permanent account deletion */}
        <section className="space-y-3 rounded-2xl border border-destructive/30 bg-card p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 text-destructive" />
            <div>
              <h2 className="font-semibold">Delete account</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Permanently delete your account, profile, rooms you own,
                and associated messages. This cannot be undone.
              </p>
            </div>
          </div>

          {!deleteAccountOpen ? (
            <Button
              type="button"
              className="btn-danger w-full"
              onClick={() => {
                setDeleteAccountPhrase("");
                setDeleteAccountOpen(true);
              }}
            >
              <Trash2 className="mr-2 size-4" />
              Delete my account
            </Button>
          ) : (
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-account-title"
              className="space-y-3 rounded-xl border border-destructive/40 p-4"
            >
              <h3 id="delete-account-title" className="font-semibold">
                Are you absolutely sure?
              </h3>

              <p className="text-sm text-muted-foreground">
                This permanently removes your account and associated data.
                Type DELETE to confirm.
              </p>

              <input
                className="field w-full"
                value={deleteAccountPhrase}
                onChange={(event) =>
                  setDeleteAccountPhrase(event.target.value)
                }
                placeholder="Type DELETE"
                autoComplete="off"
                disabled={deletingAccount}
              />

              <div className="flex gap-2">
                <Button
                  type="button"
                  className="btn-danger min-w-0 flex-1"
                  disabled={
                    deletingAccount ||
                    deleteAccountPhrase.trim() !== "DELETE"
                  }
                  onClick={handleDeleteAccount}
                >
                  {deletingAccount ? "Deleting…" : "Delete permanently"}
                </Button>

                <Button
                  type="button"
                  className="btn-ghost min-w-0 flex-1"
                  disabled={deletingAccount}
                  onClick={() => {
                    setDeleteAccountOpen(false);
                    setDeleteAccountPhrase("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </section>
      </>
    )}
  </>
)}


          
        </section>
      </div>

      <BottomNav activeTab={tab} onTabChange={handleTabChange} unread={unreadTotal} />
    </AppShell>
  );
}