
import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getAccount, saveProfile } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";

export const accountOptions = {
  queryKey: ["account"],
  queryFn: () => getAccount(),
};

function errorMessage(error) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

export default function AccountPage() {
  const { data } = useSuspenseQuery(accountOptions);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const save = useServerFn(saveProfile);

  const [displayName, setDisplayName] = useState(data.displayName ?? "");
  const [username, setUsername] = useState(data.username ?? "");
  const [bio, setBio] = useState(data.bio ?? "");
  const [website, setWebsite] = useState(data.website ?? "");
  const [avatarPath, setAvatarPath] = useState(data.avatarPath ?? null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setDisplayName(data.displayName ?? "");
    setUsername(data.username ?? "");
    setBio(data.bio ?? "");
    setWebsite(data.website ?? "");
    setAvatarPath(data.avatarPath ?? null);
  }, [
    data.displayName,
    data.username,
    data.bio,
    data.website,
    data.avatarPath,
  ]);

  useEffect(() => {
    if (!avatarPreview) return;
    return () => URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  const savedAvatarUrl = avatarPath
    ? supabase.storage
        .from("vibelive-avatars")
        .getPublicUrl(avatarPath).data.publicUrl
    : null;

  const avatarUrl = avatarPreview ?? savedAvatarUrl;

  function selectAvatar(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Your profile picture must be 5 MB or smaller.");
      return;
    }

    setError("");
    setNotice("");
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      let nextAvatarPath = avatarPath;

      if (avatarFile) {
        const extension =
          avatarFile.type === "image/png"
            ? "png"
            : avatarFile.type === "image/webp"
              ? "webp"
              : "jpg";

        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError || !authData.user) {
          throw new Error("Please sign in again.");
        }

        const path =
          `${authData.user.id}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("vibelive-avatars")
          .upload(path, avatarFile, {
            contentType: avatarFile.type,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(
            "Profile picture upload failed. Please try again."
          );
        }

        nextAvatarPath = path;
      }

      await save({
        data: {
          displayName,
          username,
          bio,
          website,
          avatarPath: nextAvatarPath,
        },
      });

      setAvatarPath(nextAvatarPath);
      setAvatarFile(null);
      setAvatarPreview(null);

      await queryClient.invalidateQueries({ queryKey: ["account"] });

      setNotice("Your profile has been saved successfully.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (busy) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await queryClient.cancelQueries();

      const { error: authError } = await supabase.auth.signOut();

      if (authError) throw authError;

      queryClient.clear();
      await navigate({ to: "/auth", replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const initials =
    displayName.trim().slice(0, 2).toUpperCase() || "VL";

  return (
    <main className="glow-bg min-h-[100dvh] px-4 py-8 sm:px-6">
      <section className="mx-auto w-full max-w-xl space-y-6">
        <header className="flex items-center justify-between">
          <Link
            to="/"
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            ← Back to rooms
          </Link>

          <span className="text-sm font-semibold">
            Vibe<span className="text-primary">Live</span>
          </span>
        </header>

        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold">
            Account settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your profile and account information.
          </p>
        </div>

        <section className="rounded-2xl border border-border bg-card/80 p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-primary/15 text-xl font-bold text-primary">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Your profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="truncate text-lg font-semibold">
                {displayName || "Your name"}
              </h2>

              <p className="truncate text-sm text-muted-foreground">
                {username ? `@${username}` : "Choose a username"}
              </p>

              <label className="inline-flex cursor-pointer text-sm font-medium text-primary hover:underline">
                {avatarFile ? "Change selected photo" : "Change profile photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={selectAvatar}
                  disabled={busy}
                />
              </label>
            </div>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            JPG, PNG, or WebP. Maximum file size: 5 MB.
          </p>
        </section>

        <form onSubmit={submit} className="space-y-5">
          <section className="space-y-5 rounded-2xl border border-border bg-card/80 p-5 sm:p-6">
            <div className="space-y-1">
              <h2 className="font-semibold">Profile information</h2>
              <p className="text-sm text-muted-foreground">
                This is how other people can identify you on VibeLive.
              </p>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium">Display name</span>
              <input
                className="field w-full"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={40}
                required
                disabled={busy}
                placeholder="Your display name"
              />
              <span className="block text-right text-xs text-muted-foreground">
                {displayName.length}/40
              </span>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium">Username</span>
              <div className="flex items-center rounded-xl border border-border bg-background px-3">
                <span className="text-muted-foreground">@</span>
                <input
                  className="w-full min-w-0 bg-transparent px-2 py-3 outline-none"
                  value={username}
                  onChange={(event) =>
                    setUsername(
                      event.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9_]/g, "")
                        .slice(0, 24)
                    )
                  }
                  maxLength={24}
                  disabled={busy}
                  placeholder="your_username"
                  autoComplete="username"
                  aria-describedby="username-help"
                />
              </div>
              <span
                id="username-help"
                className="block text-xs text-muted-foreground"
              >
                3–24 characters. Letters, numbers, and underscores.
              </span>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium">Bio</span>
              <textarea
                className="field min-h-24 w-full resize-y"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                maxLength={160}
                disabled={busy}
                placeholder="A little about yourself..."
              />
              <span className="block text-right text-xs text-muted-foreground">
                {bio.length}/160
              </span>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium">Website</span>
              <input
                className="field w-full"
                type="url"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                maxLength={200}
                disabled={busy}
                placeholder="https://example.com"
              />
            </label>

            <Button
              type="submit"
              className="btn-primary w-full"
              disabled={busy}
            >
              {busy ? "Saving changes…" : "Save changes"}
            </Button>
          </section>
        </form>

        <section className="space-y-4 rounded-2xl border border-border bg-card/80 p-5 sm:p-6">
          <div className="space-y-1">
            <h2 className="font-semibold">Account information</h2>

          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Email address</p>
            <p className="break-all text-sm font-medium">
              {data.email || "Email unavailable"}
            </p>
          </div>

          {data.createdAt && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Member since</p>
              <p className="text-sm">
                {new Date(data.createdAt).toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          )}
        </section>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        {notice && (
          <p
            role="status"
            className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm"
          >
            {notice}
          </p>
        )}

    

        <p className="pb-4 text-center text-xs text-muted-foreground">
          VibeLive · Your account, your identity.
        </p>
      </section>
    </main>
  );
}
