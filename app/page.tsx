import Link from "next/link";
import { MARKETING_DOMAIN, MARKETING_LEAD, MARKETING_SECTIONS } from "../lib/marketing/home";

export const metadata = { title: "Home" };

export default function HomePage() {
  return (
    <main className="shell">
      <header className="top">
        <div>
          <Link className="mark" href="/">WeBuilt<span>Gov</span></Link>
          <nav className="nav" aria-label="Primary">
            <Link href="/" aria-current="page">Home</Link>
            <Link href="/search">Search</Link>
          </nav>
        </div>
        <Link className="button" href="/search">Open search</Link>
      </header>
      <h1>WeBuiltGov</h1>
      <p>{MARKETING_LEAD}</p>
      <p>{MARKETING_DOMAIN}</p>
      <div className="results">
        {MARKETING_SECTIONS.map((section) => (
          <section className="card" key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
