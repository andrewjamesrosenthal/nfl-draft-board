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
    } else {
      const json = await res.json().catch(() => ({}));
      setError(
        json.error === "handle already taken"
          ? "That handle is taken — try another."
          : typeof json.error === "string"
          ? json.error
          : "Something went wrong. Try again.",
      );
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Handle <span className="text-rose-400">*</span>
        </label>
        <Input
          value={handle}
          onChange={(e) => { setHandle(e.target.value); setSaved(false); }}
          placeholder="scout_2026"
          pattern="[a-zA-Z0-9_\-]+"
          minLength={2}
          maxLength={30}
        />
        <p className="text-[11px] text-muted-foreground">
          Letters, numbers, _ and - only. Visible on your public profile.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Display name
        </label>
        <Input
          value={displayName}
          onChange={(e) => { setDisplayName(e.target.value); setSaved(false); }}
          placeholder="Optional — defaults to your handle"
          maxLength={50}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Email
        </label>
        <Input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setSaved(false); }}
          placeholder="you@example.com"
        />
        <p className="text-[11px] text-muted-foreground">
          Optional. Used to restore your board on a new device in the future.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-sm text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {isAnonymous ? "Account created! Welcome aboard." : "Saved."}
        </div>
      )}

      <Button
        type="submit"
        disabled={loading || handle.length < 2}
        className="w-full"
      >
        {loading ? "Saving…" : isAnonymous ? "Create account" : "Save changes"}
      </Button>
    </form>
  );
}
