import { Agent2D } from "@/components/agent/Agent2D";
import { ButtonLink } from "@/components/ui/Button";

/** Friendly placeholder for screens that aren't built yet. */
export function ComingSoon({ title, body }: { title: string; body: string }) {
  return (
    <section className="glass mx-auto flex max-w-xl flex-col items-center gap-5 rounded-xl px-6 py-14 text-center">
      <Agent2D state="idle" size={110} />
      <p className="rounded-full bg-teal-soft px-3 py-1 text-xs font-medium tracking-wide text-teal uppercase">Coming soon</p>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted">{body}</p>
      <ButtonLink href="/" variant="secondary">Check a coin instead</ButtonLink>
    </section>
  );
}
