"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/",      label: "GS Design" },
  { href: "/simon", label: "Simon 2-Stage" },
];

export function NavBar() {
  const pathname = usePathname();
  return (
    <header className="border-b border-az-platinum bg-white/90 backdrop-blur sticky top-0 z-20 print-hidden">
      <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center gap-6">
        <span
          className="text-base font-bold text-az-navy shrink-0"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          GS-Intersect
        </span>
        <nav className="flex gap-1">
          {TABS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  active
                    ? "bg-az-mulberry text-white"
                    : "text-az-graphite hover:text-az-mulberry hover:bg-az-light-platinum"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto hidden sm:flex items-center gap-3">
          <p className="text-xs font-medium text-az-graphite">AstraZeneca</p>
          <div
            className="w-3 h-8 rounded-sm"
            style={{ background: "linear-gradient(180deg, #830051 0%, #003865 100%)" }}
          />
        </div>
      </div>
    </header>
  );
}
