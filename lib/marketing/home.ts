export const MARKETING_DOMAIN = "webuiltgov.com is the intended domain and is not connected yet.";

export const MARKETING_LEAD = "WeBuiltGov is a workspace for one organization to follow a stored Grants.gov funding opportunity from search through recorded payments. This page does not require sign-in. Search and the rest of the workspace do.";

export const MARKETING_SECTIONS: { title: string; body: string }[] = [
  {
    title: "Grants.gov funding-opportunity search",
    body: "An owner or admin can sync posted funding opportunities from Grants.gov. Grants.gov does not need an API key. Members search the stored catalog. A blank field means the source did not provide it.",
  },
  {
    title: "Company readiness",
    body: "A member records legal business information, registrations, licenses, certifications, insurance, and bonding, including status, source, verification date, expiration, and a responsible person. Empty fields stay empty. The readiness view shows what is missing or expiring.",
  },
  {
    title: "Eligibility marks",
    body: "For one stored opportunity, a member marks each applicant type already stored on the notice as satisfied, unsatisfied, potentially correctable, needs verification, or not applicable. The workspace does not invent eligibility.",
  },
  {
    title: "Pursuit suggestions from stored records",
    body: "A pursuit suggestion is calculated from stored readiness and eligibility marks. A person sets the recommendation and must enter a reason to change it. The suggestion uses those stored fields.",
  },
  {
    title: "A person-entered bid estimate with approval",
    body: "A member opens a bid and enters labor, materials, equipment, subcontractors, overhead, contingency, profit, and a proposed price. Low, expected, and high totals use only the numbers entered. The proposed price stays a draft until a member approves it, and the approval stores who approved it.",
  },
  {
    title: "A proposal PDF from saved text",
    body: "A member saves cover, understanding of the project, and technical approach. Past performance repeats readiness records a person already saved, or verified projects a person types. The downloadable PDF contains that saved text.",
  },
  {
    title: "A submission record that requires a typed confirmation",
    body: "A submission is stored only when a member types a confirmation number, the official destination, and the time. The workspace stores who entered it. It does not send the record to a government portal or by email.",
  },
  {
    title: "Vendor quotes",
    body: "Inside one organization, a member types a vendor name and trade. A quote needs a vendor, an amount, and what it covers. Quotes for one bid are compared by the amounts entered. They are not emailed outside the organization.",
  },
  {
    title: "An award a person records",
    body: "An award is stored only when a member types the awarded amount, the award date, and the source. A blank field is rejected and no fulfillment project is created. After the award is saved, a member can type milestones and obligations. Work stays incomplete until a person checks it.",
  },
  {
    title: "Invoices with recorded payments",
    body: "After an award is saved, a member types an invoice number and an amount. The amount cannot exceed the awarded amount already stored. The invoice starts unpaid. A payment is stored when a member types an amount and a date against that invoice. The invoice is paid only when recorded payments cover the invoice amount. Awarded value, invoiced total, and collected total are shown as separate numbers.",
  },
];

export function marketingText(): string {
  return [MARKETING_LEAD, MARKETING_DOMAIN, ...MARKETING_SECTIONS.flatMap((section) => [section.title, section.body])].join("\n");
}
