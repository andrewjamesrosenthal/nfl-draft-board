"use client";
import { useState } from "react";
import { Button } from "./ui/button";
import { Eye, EyeOff } from "lucide-react";

export function WatchlistToggle({
  playerId,
  initiallyIn,
}: {
  playerId: number;
  initiallyIn: boolean;
}) {
  const [inList, setInList] = useState(initiallyIn);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    if (inList) {
      await fetch(`/api/user/watchlist?playerId=${playerId}`, { method: "DELETE" });
      setInList(false);
    } else {
      await fetch(`/api/user/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      setInList(true);
    }
    setLoading(false);
  }

  return (
    <Button
      variant={inList ? "secondary" : "outline"}
      size="sm"
      onClick={toggle}
      disabled={loading}
      className="gap-1"
    >
      {inList ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      {inList ? "Watching" : "Watch"}
    </Button>
  );
}
