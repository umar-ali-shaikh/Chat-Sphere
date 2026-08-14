import { motion } from "motion/react";

export function TypingIndicator({ name }: { name: string }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex items-center gap-2"
    >
      <span className="flex items-center gap-1 rounded-full bg-bubble-in px-3 py-2">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-1.5 rounded-full bg-muted-foreground"
            animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </span>
      <span className="text-xs text-muted-foreground">{name} is typing…</span>
    </motion.li>
  );
}