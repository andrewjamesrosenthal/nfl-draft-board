"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle } from "lucide-react";

export function AccountForm({
  initial,
  isAnonymous,
}: {
  initial: { handle: string; displayName: string; email: string };
  isAnonymous: boolean;
}) {
  const [handle, setHandle] = useState(initial.handle);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [email, setEmail] = useState(initial.email);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/user/identity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handle,
        displayName: displayName || undefined,
        email: email || undefined,
      }),
    });
    setLoading(false);
    if (res.ok) {
      setSaved(true);
      if (isAnonymous) {
        // Reload so the page switches to the "has account" state.
        window.location.reload();
      }
    } else {
      const json = await res.json().catch(() => ({}));
      setError(
        json.error === "handle already taken"
          ? "That username is taken — try another."
          : json.error === "email already registered"
          ? "That email is already linked to another account."
          : typeof json.error === "string"
          ? json.error
          : "Something went wrong. Try again.",
      );
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">
          Username <span className="text-rose-400">*</span>
        </label>
        <Input
          value={handle}
          onChange={(e) => { setHandle(e.target.value); setSaved(false); }}
          placeholder="e.g. john_scout"
          pattern="[a-zA-Z0-9_\-]+"
          minLength={2}
          maxLength={30}
          autoComplete="username"
        />
        <p className="text-xs text-muted-foreground">
          Letters, numbers, underscores, hyphens. This is your public handle.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Display name</label>
        <Input
          value={displayName}
          onChange={(e) => { setDisplayName(e.target.value); setSaved(false); }}
          placeholder="Optional — shown on your profile"
          maxLength={50}
          autoComplete="name"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Email</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setSaved(false); }}
          placeholder="you@example.com"
          autoComplete="email"
        />
        <p className="text-xs text-muted-foreground">
          Optional. Lets you recover your board on a new device.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2.5 text-sm text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {saved && !isAnonymous && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Saved.
        </div>
      )}

      <Button type="submit" disabled={loading || handle.length < 2} className="w-full">
        {loading
          ? "Saving…"
          : isAnonymous
          ? "Create account"
          : "Save changes"}
      </Button>
    </form>
  );
}
