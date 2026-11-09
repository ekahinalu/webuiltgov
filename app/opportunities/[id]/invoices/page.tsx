import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell, SignedOut } from "../../../../components/chrome";
import { hasRole } from "../../../../lib/auth/roles";
import { getPagePrincipal } from "../../../../lib/auth/session";
import { formatMoney } from "../../../../lib/bids/model";
import { formatIsoDate } from "../../../../lib/dates";
import { getDb } from "../../../../lib/db/client";
import { invoiceWorkspace, type InvoiceRecord } from "../../../../lib/invoices/service";

export const metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function totalText(cents: number | null, empty: string): string {
  return cents === null ? empty : formatMoney(cents);
}

function InvoiceCard({ invoice, canEdit, opportunityId }: { invoice: InvoiceRecord; canEdit: boolean; opportunityId: string }) {
  return (
    <article className="result">
      <div className="badges">
        <span className={invoice.paid ? "badge" : "badge warn"}>{invoice.paid ? "Paid" : "Unpaid"}</span>
      </div>
      <h2 style={{ marginTop: "0.55rem" }}>{invoice.number}</h2>
      <p>Invoice amount: {formatMoney(invoice.amountCents)}.</p>
      {invoice.payments.length === 0 ? <p>No payments are recorded.</p> : null}
      {invoice.payments.map((payment) => (
        <p key={payment.id}>
          Payment {formatMoney(payment.amountCents)} on {formatIsoDate(payment.paidOn) ?? "Not stored"}, entered by {payment.enteredByName}.
        </p>
      ))}
      {canEdit ? (
        <form method="post" action="/api/invoices" className="stack" style={{ marginTop: "0.6rem" }}>
          <input type="hidden" name="intent" value="payment" />
          <input type="hidden" name="opportunityId" value={opportunityId} />
          <input type="hidden" name="invoiceId" value={invoice.id} />
          <label>
            <span>Payment amount</span>
            <input name="amount" inputMode="decimal" />
          </label>
          <label>
            <span>Payment date</span>
            <input name="paidOn" type="date" />
          </label>
          <button type="submit">Save payment</button>
        </form>
      ) : null}
    </article>
  );
}

export default async function InvoicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const principal = await getPagePrincipal();
  if (!principal) return <SignedOut />;
  const { id } = await params;
  const query = await searchParams;
  const view = await invoiceWorkspace(await getDb(), principal, id);
  if (!view) notFound();
  const canEdit = hasRole(principal.role, "member");
  return (
    <Shell principal={principal} path={`/opportunities/${view.opportunityId}/invoices`} notice={one(query.notice)}>
      <p><Link href={`/opportunities/${view.opportunityId}`}>Back to {view.solicitationNumber ?? view.title}</Link></p>
      <h1>Invoices and payments</h1>
      <p>
        {view.title} for {principal.organizationName}. Invoices can be added only after an award is saved.
        Nothing here is created from the notice. Profit is not calculated.
      </p>
      <section className="card">
        <h2>Totals</h2>
        <dl className="facts" style={{ gridTemplateColumns: "1fr" }}>
          <div><dt>Awarded value</dt><dd>{totalText(view.awardedCents, "No award is stored")}</dd></div>
          <div><dt>Invoiced total</dt><dd>{totalText(view.invoicedCents, "No invoices entered")}</dd></div>
          <div><dt>Collected total</dt><dd>{totalText(view.collectedCents, "No payments entered")}</dd></div>
        </dl>
      </section>
      {view.awardedCents === null ? (
        <section className="card" style={{ marginTop: "1rem" }}>
          <h2>Invoices</h2>
          <p>Save an award before adding an invoice. No invoice was created from this notice.</p>
        </section>
      ) : (
        <section className="card" style={{ marginTop: "1rem" }}>
          <h2>Invoices</h2>
          <p>An invoice starts unpaid. It is paid only when the payments recorded against it cover its amount. An invoice amount cannot be above the awarded value.</p>
          {view.invoices.length === 0 ? <p>No invoices are stored.</p> : null}
          <div className="results">
            {view.invoices.map((invoice) => (
              <InvoiceCard key={invoice.id} invoice={invoice} canEdit={canEdit} opportunityId={view.opportunityId} />
            ))}
          </div>
          {canEdit ? (
            <form method="post" action="/api/invoices" className="stack" style={{ marginTop: "0.8rem" }}>
              <input type="hidden" name="intent" value="invoice" />
              <input type="hidden" name="opportunityId" value={view.opportunityId} />
              <label>
                <span>Invoice number</span>
                <input name="number" maxLength={80} />
              </label>
              <label>
                <span>Amount</span>
                <input name="amount" inputMode="decimal" />
              </label>
              <button type="submit">Save invoice</button>
            </form>
          ) : <p>Viewers can read invoices and payments and cannot add them.</p>}
        </section>
      )}
    </Shell>
  );
}
