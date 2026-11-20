"use client";

import { motion, useMotionValue, useSpring } from "motion/react";
import { useRef } from "react";
import { cn } from "@/lib/cn";
import { spring, TILT_MAX_DEG } from "@/lib/motion";

/**
 * Gentle 3D tilt on hover (max 4°) plus a light edge that follows the pointer.
 * Only on fine pointers and in "full" graphics; reduced motion and simple graphics
 * get a flat card (CSS hides the light edge; we skip the tilt).
 */
export function TiltCard({ className, children, calm = false, ...rest }: React.HTMLAttributes<HTMLDivElement> & { calm?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const sx = useSpring(rx, spring.tilt);
  const sy = useSpring(ry, spring.tilt);

  const enabled = () =>
    !calm &&
    document.documentElement.dataset.graphics !== "simple" &&
    window.matchMedia("(pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
    if (!enabled()) return;
    ry.set((px - 0.5) * 2 * TILT_MAX_DEG);
    rx.set(-(py - 0.5) * 2 * TILT_MAX_DEG);
  };
  const reset = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={{ rotateX: sx, rotateY: sy, transformPerspective: 900 }}
      className={cn("light-edge h-full rounded-lg", className)}
      {...(rest as object)}
    >
      {children}
    </motion.div>
  );
}
