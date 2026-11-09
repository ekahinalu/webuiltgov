import Link from "next/link";
import type { Principal } from "../lib/auth/principal";
import { ROLE_LABEL } from "../lib/domain";
import { noticeText } from "../lib/notices";

export function SignedOut() {
  return (
    <main className="shell">
      <p className="mark">WeBuilt<span>Gov</span></p>
      <h1>Sign in to search opportunities</h1>
      <p>
        WeBuiltGov keeps each organization&apos;s members, roles, and pipeline separate.
        The host signs you in before this app opens. If you are already signed in and still see this page,
        the request did not include a verified person.
      </p>
    </main>
  );
}

export function Shell({
  principal,
  path,
  notice,
  children,
}: {
  principal: Principal;
  path: string;
  notice?: string;
  children: React.ReactNode;
}) {
  const message = noticeText(notice);
  const links = [
    ["/", "Search"],
    ["/readiness", "Readiness"],
    ["/connectors", "Connectors"],
    ["/organization", "Organization"],
    ["/ai", "AI"],
  ];
  return (
    <div className="shell">
      <header className="top">
        <div>
          <Link className="mark" href="/">WeBuilt<span>Gov</span></Link>
          <nav className="nav" aria-label="Primary">
            {links.map(([href, label]) => (
              <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>{label}</Link>
            ))}
          </nav>
        </div>
        <div className="who">
          <strong>{principal.organizationName}</strong>
          <span>{ROLE_LABEL[principal.role]}{principal.name ? ` · ${principal.name}` : ""}</span>
          {principal.memberships.length > 1 ? (
            <form method="post" action="/api/organization" className="inline">
              <input type="hidden" name="intent" value="switch" />
              <label>
                <span>Organization</span>
                <select name="organizationId" defaultValue={principal.organizationId}>
                  {principal.memberships.map((membership) => (
                    <option key={membership.organizationId} value={membership.organizationId}>{membership.name}</option>
                  ))}
                </select>
              </label>
              <button type="submit">Switch</button>
            </form>
          ) : null}
        </div>
      </header>
      {principal.simulated ? (
        <p className="banner">Local preview uses a simulated viewer named Dev Viewer. This is not a signed-in account.</p>
      ) : null}
      {principal.plane === "preview" ? (
        <p className="banner">This is the preview environment. Its organizations and catalog are stored apart from production.</p>
      ) : null}
      {message ? <p className="notice" role="status">{message}</p> : null}
      {children}
    </div>
  );
}
