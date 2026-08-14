import { Link, createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Bell, Image as ImageIcon, MessagesSquare, ShieldCheck, Sparkle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AmbientScene } from "@/components/three/ambient-scene";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ChatSphere — realtime messaging that feels instant" },
      {
        name: "description",
        content:
          "Presence, typing indicators, read receipts and image sharing in a glassy realtime workspace built for teams.",
      },
      { property: "og:title", content: "ChatSphere — realtime messaging that feels instant" },
      {
        property: "og:description",
        content: "Presence, typing indicators, read receipts and image sharing in one glassy realtime workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Zap, title: "Sub-50ms delivery", body: "Messages land before your finger leaves the key." },
  { icon: MessagesSquare, title: "Presence & typing", body: "See who's around and who's mid-thought." },
  { icon: ImageIcon, title: "Rich attachments", body: "Drop images inline with instant previews." },
  { icon: Bell, title: "Smart notifications", body: "Toasts, badges and browser alerts that respect focus." },
  { icon: ShieldCheck, title: "Read receipts", body: "Sent, delivered and seen — never guess again." },
  { icon: Sparkle, title: "Built to feel good", body: "Glass surfaces, soft depth, careful motion." },
];

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ backgroundImage: "var(--gradient-surface)" }}
      />
      <AmbientScene className="opacity-70" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <span className="flex items-center gap-2 font-display text-lg font-bold">
          <span
            className="grid size-8 place-items-center rounded-xl text-primary-foreground"
            style={{ backgroundImage: "var(--gradient-brand)" }}
          >
            <MessagesSquare className="size-4" />
          </span>
          ChatSphere
        </span>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link to="/register">Get started</Link>
          </Button>
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-5 pb-24">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="pt-16 pb-20 text-center sm:pt-24"
        >
          <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-accent" />
            Realtime, everywhere
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl leading-[1.05] font-bold sm:text-6xl">
            Conversations that move at the <span className="text-gradient">speed of thought</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            ChatSphere is a realtime messaging workspace with presence, typing indicators, read
            receipts and image sharing — wrapped in an interface that stays out of your way.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="surface-glow rounded-2xl px-7">
              <Link to="/chat">Open the app</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-2xl px-7">
              <Link to="/register">Create an account</Link>
            </Button>
          </div>
        </motion.section>

        <section aria-label="Features" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.article
              key={f.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.05 }}
              className="glass rounded-3xl p-6 transition-transform hover:-translate-y-1"
            >
              <span className="grid size-10 place-items-center rounded-2xl bg-primary/12 text-primary">
                <f.icon className="size-5" />
              </span>
              <h2 className="mt-4 text-base font-semibold">{f.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </motion.article>
          ))}
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        ChatSphere — built for teams that live in their inbox alternatives.
      </footer>
    </div>
  );
}
