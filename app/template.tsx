"use client";

import { motion } from "motion/react";
import { duration, ease, page } from "@/lib/motion";

/** Page transition: fade + slight depth (template.tsx re-mounts on every navigation). */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={page.from} animate={page.to} transition={{ duration: duration.slow, ease: ease.out }} style={{ transformOrigin: "50% 0" }}>
      {children}
    </motion.div>
  );
}
