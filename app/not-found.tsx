import Link from "next/link";

export default function NotFound() {
  return (
    <main className="shell">
      <h1>Not in the catalog</h1>
      <p>That opportunity is not stored for this environment.</p>
      <p><Link href="/">Back to search</Link></p>
    </main>
  );
}
