import { CATEGORY_LABEL, READINESS_CATEGORIES, STATUS_LABEL, type ReadinessCategory, type ReadinessStatus } from "../lib/readiness/model";

export function ReadinessFields({
  category,
  label,
  recordedValue,
  status,
  source,
  verifiedOn,
  expiresOn,
  responsiblePerson,
  lockCategory,
}: {
  category?: ReadinessCategory;
  label?: string | null;
  recordedValue?: string | null;
  status?: ReadinessStatus | null;
  source?: string | null;
  verifiedOn?: string | null;
  expiresOn?: string | null;
  responsiblePerson?: string | null;
  lockCategory?: boolean;
}) {
  return (
    <div className="record-grid">
      <label>
        <span>Category</span>
        {lockCategory && category ? (
          <>
            <input type="hidden" name="category" value={category} />
            <input value={CATEGORY_LABEL[category]} readOnly />
          </>
        ) : (
          <select name="category" defaultValue={category ?? ""} required>
            <option value="">Choose a category</option>
            {READINESS_CATEGORIES.map((item) => (
              <option key={item} value={item}>{CATEGORY_LABEL[item]}</option>
            ))}
          </select>
        )}
      </label>
      <label>
        <span>Status</span>
        <select name="status" defaultValue={status ?? ""}>
          <option value="">Not set</option>
          {(Object.keys(STATUS_LABEL) as ReadinessStatus[]).map((item) => (
            <option key={item} value={item}>{STATUS_LABEL[item]}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Label</span>
        <input name="label" defaultValue={label ?? ""} maxLength={200} />
      </label>
      <label>
        <span>Recorded value</span>
        <input name="recordedValue" defaultValue={recordedValue ?? ""} maxLength={2000} />
      </label>
      <label>
        <span>Source</span>
        <input name="source" defaultValue={source ?? ""} maxLength={200} />
      </label>
      <label>
        <span>Responsible person</span>
        <input name="responsiblePerson" defaultValue={responsiblePerson ?? ""} maxLength={120} />
      </label>
      <label>
        <span>Verification date</span>
        <input name="verifiedOn" type="date" defaultValue={verifiedOn ?? ""} />
      </label>
      <label>
        <span>Expiration</span>
        <input name="expiresOn" type="date" defaultValue={expiresOn ?? ""} />
      </label>
    </div>
  );
}
