/**
 * Covex motion tokens: the one place timings, easings and springs live.
 * CSS mirrors the durations as --duration-fast/base/slow in app/globals.css.
 *
 * Rules: UI motion uses these tokens only; nothing loops forever except the
 * "working" breath of the logo mark and step shimmer; rescue pages use `calm`.
 */
export const duration = {
  fast: 0.15,
  base: 0.25,
  slow: 0.4,
} as const;

export const ease = {
  out: [0.2, 0.8, 0.2, 1] as [number, number, number, number],
  inOut: [0.65, 0, 0.35, 1] as [number, number, number, number],
};

export const spring = {
  /** Sidebar active indicator, toggles: quick, no overshoot you'd notice. */
  snappy: { type: "spring", stiffness: 520, damping: 40, mass: 0.8 },
  /** Cards assembling, panels opening. */
  soft: { type: "spring", stiffness: 260, damping: 30, mass: 0.9 },
  /** Hover tilt following the pointer. */
  tilt: { type: "spring", stiffness: 300, damping: 26, mass: 0.6 },
} as const;

/** Stagger between items that assemble in sequence (seconds). */
export const stagger = { tight: 0.04, base: 0.07, calm: 0.12 } as const;

/** Max hover tilt in degrees (kept small so text stays readable). */
export const TILT_MAX_DEG = 4;

/** Depth used when report cards assemble: start slightly "behind" the page. */
export const assemble = {
  from: { opacity: 0, y: 14, rotateX: -8, scale: 0.98 },
  to: { opacity: 1, y: 0, rotateX: 0, scale: 1 },
} as const;

/** Page transition: fade + slight depth. */
export const page = {
  from: { opacity: 0, y: 6, scale: 0.995 },
  to: { opacity: 1, y: 0, scale: 1 },
} as const;

/** Calm mode (rescue pages): slower, smaller, no tilt. */
export const calm = { duration: duration.slow, distance: 6 } as const;
