import { AppError } from "../../../lib/auth/roles";
import { getDb } from "../../../lib/db/client";
import { isUuid } from "../../../lib/domain";
import { formValue, guardPost, redirectTo } from "../../../lib/http";
import { addInvoice, addPayment } from "../../../lib/invoices/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guarded = await guardPost(request);
  if (guarded instanceof Response) return guarded;
  const form = await request.formData();
  const intent = formValue(form, "intent");
  const opportunityId = formValue(form, "opportunityId");
  const back = isUuid(opportunityId) ? `/opportunities/${opportunityId}/invoices` : "/";
  try {
    const db = await getDb();
    if (intent === "invoice") {
      await addInvoice(db, guarded.principal, opportunityId, {
        number: formValue(form, "number"),
        amount: formValue(form, "amount"),
      });
      return redirectTo(request, `${back}?notice=invoice-saved`);
    }
    if (intent === "payment") {
      await addPayment(db, guarded.principal, opportunityId, {
        invoiceId: formValue(form, "invoiceId"),
        amount: formValue(form, "amount"),
        paidOn: formValue(form, "paidOn"),
      });
      return redirectTo(request, `${back}?notice=payment-saved`);
    }
    return redirectTo(request, `${back}?notice=invoice-invalid`);
  } catch (error) {
    const code = error instanceof AppError ? error.code : "invoice-invalid";
    return redirectTo(request, `${back}?notice=${code}`);
  }
}
