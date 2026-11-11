"use client";
import { useEffect, useState } from "react";
import { loadPicks, type Status } from "@/lib/picks-client";

export default function StorageNotice() {
  const [s, setS] = useState<Status | null>(null);
  useEffect(() => { loadPicks().then((x) => setS(x.status)); }, []);
  if (!s || s.configured) return null;
  return (
    <div className="card" style={{ borderColor: "var(--d)" }}>
      <b>Pick storage isn&apos;t set up yet.</b>
      <div className="note">
        Your picks are saved on the server so every browser sees them. Connect a free Redis database to the Vercel project (Storage → Create → Upstash Redis) and redeploy; see the README. Until then, the pick boxes are disabled.
      </div>
    </div>
  );
}
