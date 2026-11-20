"use client";

import { motion } from "motion/react";
import { assemble, spring, stagger } from "@/lib/motion";

/** Staggered reveal when scrolled into view (children use RevealItem). */
export function Reveal({ as = "div", className, children, calm = false }: { as?: "div" | "ul" | "ol" | "section"; className?: string; children: React.ReactNode; calm?: boolean }) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      style={{ perspective: 1200 }}
      initial="from"
      whileInView="to"
      viewport={{ once: true, margin: "-8% 0px" }}
      variants={{ to: { transition: { staggerChildren: calm ? stagger.calm : stagger.base } } }}
    >
      {children}
    </Tag>
  );
}

export function RevealItem({ as = "div", className, children, calm = false }: { as?: "div" | "li"; className?: string; children: React.ReactNode; calm?: boolean }) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      style={{ transformOrigin: "50% 100%" }}
      variants={
        calm
          ? { from: { opacity: 0, y: 6 }, to: { opacity: 1, y: 0, transition: { duration: 0.4 } } }
          : { from: assemble.from, to: { ...assemble.to, transition: spring.soft } }
      }
    >
      {children}
    </Tag>
  );
}
