import { Shell, SignedOut } from "../../components/chrome";
import { hasRole } from "../../lib/auth/roles";
import { getPagePrincipal } from "../../lib/auth/session";
import { getDb } from "../../lib/db/client";
import { ROLE_LABEL } from "../../lib/domain";
import { listInvites, listMembers } from "../../lib/org/service";

export const metadata = { title: "Organization" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function OrganizationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const principal = await getPagePrincipal();
  if (!principal) return <SignedOut />;
  const params = await searchParams;
  const db = await getDb();
  const members = await listMembers(db, principal);
  const manage = hasRole(principal.role, "admin");
  const invites = manage ? await listInvites(db, principal) : [];
  return (
    <Shell principal={principal} path="/organization" notice={one(params.notice)}>
      <h1>{principal.organizationName}</h1>
      <p>Your role is {ROLE_LABEL[principal.role]}. People in another organization cannot see this pipeline or these invites.</p>
      {manage ? (
        <form method="post" action="/api/organization" className="card stack">
          <h2>Rename</h2>
          <input type="hidden" name="intent" value="rename" />
          <label>
            <span>Organization name</span>
            <input name="name" defaultValue={principal.organizationName} maxLength={80} required />
          </label>
          <button type="submit">Save name</button>
        </form>
      ) : null}
      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Members</h2>
        <table className="members">
          <thead>
            <tr><th>Person</th><th>Role</th>{manage ? <th>Change</th> : null}</tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.userId}>
                <td>{member.name || (manage ? member.email : "Member") || "Member"}</td>
                <td>{ROLE_LABEL[member.role]}</td>
                {manage ? (
                  <td>
                    <form method="post" action="/api/organization" className="inline">
                      <input type="hidden" name="intent" value="role" />
                      <input type="hidden" name="userId" value={member.userId} />
                      <select name="role" defaultValue={member.role}>
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button type="submit">Update</button>
                    </form>
                    <form method="post" action="/api/organization">
                      <input type="hidden" name="intent" value="remove" />
                      <input type="hidden" name="userId" value={member.userId} />
                      <button className="secondary" type="submit">Remove</button>
                    </form>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {manage ? (
        <form method="post" action="/api/organization" className="card stack" style={{ marginTop: "1rem" }}>
          <h2>Invite</h2>
          <p className="meta">Email sending is not part of this version. The invite is stored and applied when that email signs in.</p>
          <input type="hidden" name="intent" value="invite" />
          <label>
            <span>Email</span>
            <input name="email" type="email" required />
          </label>
          <label>
            <span>Role</span>
            <select name="role" defaultValue="member">
              <option value="viewer">Viewer</option>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          {invites.length > 0 ? (
            <ul>
              {invites.map((invite) => (
                <li key={invite.id}>{invite.email} · {invite.role}</li>
              ))}
            </ul>
          ) : <p className="meta">No pending invites.</p>}
          <button type="submit">Save invite</button>
        </form>
      ) : null}
    </Shell>
  );
}
