"use client";

import { useSyncExternalStore } from "react";
import { readSimplePref, writeSimplePref } from "./graphics";

function subscribe(cb: () => void) {
  window.addEventListener("bagcheck:graphics", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("bagcheck:graphics", cb);
    window.removeEventListener("storage", cb);
  };
}

/** "Use simple graphics" switch: forces the 2D agent everywhere. */
export function GraphicsToggle() {
  const on = useSyncExternalStore(subscribe, readSimplePref, () => false);
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm text-muted">
      <input
        type="checkbox"
        role="switch"
        checked={on}
        onChange={(e) => writeSimplePref(e.target.checked)}
        className="size-5 accent-teal"
      />
      Use simple graphics
    </label>
  );
}
