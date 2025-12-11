"use client";

import React, { useEffect, useState } from "react";

type Banner = { text: string; tone: "success" | "warning" | "error" };

export default function BannerList({ items }: { items: Banner[] }) {
  const [visible, setVisible] = useState(items);

  useEffect(() => {
    setVisible(items);
    const timers = items.map((_, i) =>
      setTimeout(() => {
        setVisible((v) => v.filter((_, idx) => idx !== i));
      }, 4000)
    );
    return () => timers.forEach(clearTimeout);
  }, [items]);

  if (!visible.length) return null;

  return (
    <div className="space-y-2">
      {visible.map((banner, idx) => (
        <div
          key={`${banner.text}-${idx}`}
          className={`rounded-xl border px-4 py-3 text-sm ${
            banner.tone === "success"
              ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-100"
              : banner.tone === "warning"
              ? "bg-amber-500/15 border-amber-400/40 text-amber-100"
              : "bg-rose-500/15 border-rose-400/40 text-rose-100"
          }`}
        >
          {banner.text}
        </div>
      ))}
    </div>
  );
}
