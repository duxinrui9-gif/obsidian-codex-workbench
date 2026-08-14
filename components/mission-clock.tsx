"use client";

import { useEffect, useState } from "react";
import { clientTimeZone } from "@/lib/vault-profile";

function time() { return new Intl.DateTimeFormat("zh-Hans-CN", { timeZone: clientTimeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date()); }

export function MissionClock() {
  const [now, setNow] = useState("");
  useEffect(() => { const initial = window.setTimeout(() => setNow(time()), 0); const timer = window.setInterval(() => setNow(time()), 1000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, []);
  return <span className="mission-clock" aria-label={now ? `香港时间 ${now}` : "香港时间正在同步"}>{now ? `${now} HKT` : "--:--:-- HKT"}</span>;
}
