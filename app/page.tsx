import Link from "next/link";

// Placeholder home. The real home (3D agent hero, search, stage cards) is built in phases b and c.
export default function Home() {
  return (
    <section className="space-y-4">
      <h1 className="text-4xl font-semibold tracking-tight">Bagcheck</h1>
      <p className="max-w-xl text-mist">
        Did the founders keep their promises, and can you still get out? Work in progress: phase a (CMC client and API
        evidence).
      </p>
      <Link href="/evidence" className="inline-block rounded-lg bg-teal px-4 py-2 font-medium text-ink-950">
        See real API calls
      </Link>
    </section>
  );
}
