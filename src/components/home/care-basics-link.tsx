"use client";

import type { MouseEvent, ReactNode } from "react";

/*
 * Care basics hash link.
 *
 * `next/link` runs hash URLs through its client router, which can
 * re-serialise the fragment and turn `#care-basics` into `%23care-basics` —
 * a path that does not exist, so the click ends in a 404. A native <a> lets
 * the browser parse the URL itself, so the hash is never encoded.
 *
 * The href is always the plain `/#care-basics` form (fragments are never sent
 * to the server, so this resolves cleanly to the home page). When the visitor
 * is already on the home page we scroll in place instead of reloading, and
 * push the bare `#care-basics` fragment into the address bar.
 */
export function CareBasicsLink({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    // Let modified clicks (new tab, download, etc.) behave normally.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    if (window.location.pathname !== "/") return;

    const target = document.getElementById("care-basics");
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.pushState(null, "", "#care-basics");
  }

  return (
    // Native anchor on purpose: next/link would re-encode the # fragment.
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a href="/#care-basics" onClick={handleClick} className={className}>
      {children}
    </a>
  );
}
