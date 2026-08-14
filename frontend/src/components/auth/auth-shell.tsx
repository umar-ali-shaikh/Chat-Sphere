import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { MessagesSquare } from "lucide-react";
import { AmbientScene } from "@/components/three/ambient-scene";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden px-5 py-12">
      <div aria-hidden className="absolute inset-0" style={{ backgroundImage: "var(--gradient-surface)" }} />
      <AmbientScene />
      <motion.main
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="glass surface-glow relative z-10 w-full max-w-md rounded-3xl p-7 sm:p-9"
      >
        <Link to="/" className="flex items-center gap-2 font-display text-base font-bold">
          <span
            className="grid size-8 place-items-center rounded-xl text-primary-foreground"
            style={{ backgroundImage: "var(--gradient-brand)" }}
          >
            <MessagesSquare className="size-4" />
          </span>
          ChatSphere
        </Link>
        <h1 className="mt-7 text-2xl font-bold">{title}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
        <div className="mt-7">{children}</div>
        <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
      </motion.main>
    </div>
  );
}