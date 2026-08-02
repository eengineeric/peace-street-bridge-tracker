"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const links = [
  ["Home", "#top", "⌂"],
  ["Incidents", "#incidents", "▱"],
  ["Stats", "#stats", "▥"],
  ["Gallery", "#gallery", "▧"],
  ["About", "#history", "ⓘ"],
] as const;

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (open && rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav-menu"
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-400/60 bg-sky-400/5 text-xl text-sky-200"
      >
        <span aria-hidden="true">{open ? "×" : "☰"}</span>
        <span className="sr-only">{open ? "Close navigation" : "Open navigation"}</span>
      </button>

      {open ? (
        <div id="mobile-nav-menu" className="absolute right-0 z-50 mt-2 w-52 rounded-2xl border border-white/10 bg-[#071124] p-2 shadow-2xl">
          <nav aria-label="Mobile navigation" className="grid gap-1">
            {links.map(([label, href, icon]) => (
              <a
                key={label}
                href={href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-bold text-slate-100 hover:bg-white/10 hover:text-amber-300"
              >
                <span aria-hidden="true" className="mr-1.5 text-amber-400">{icon}</span>
                {label}
              </a>
            ))}
          </nav>
          <Link
            href="/admin"
            onClick={() => setOpen(false)}
            className="mt-1 block rounded-lg px-3 py-2.5 text-sm font-bold text-sky-200 hover:bg-sky-400/10"
          >
            <span aria-hidden="true" className="mr-1.5">🔒</span>Admin access
          </Link>
        </div>
      ) : null}
    </div>
  );
}
