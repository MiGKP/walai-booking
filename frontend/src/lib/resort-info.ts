export type ResortPrefer = 'main' | 'room' | 'boat';

export interface ResortInfoRecord {
  id?: number;
  name?: string;
  address?: string;
  coordinates?: string;
  phone?: string;
  email?: string;
  facebook?: string;
  line_id?: string;
  operating_days?: string;
  operating_hours?: string;
  additional_terms?: string;
  payment_due_days?: number | null;
  bank_account_no?: string;
  bank_account_name?: string;
  promptpay_id?: string;
  [key: string]: unknown;
}

function cleanString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value);
  return text.length > 0 ? text : undefined;
}

/**
 * GET /settings/resort may return one object (?id=) or an array (main=3, room=4, boat=5).
 * Public pages expect a single object — pick the right row.
 */
export function pickResortInfo(
  data: unknown,
  prefer: ResortPrefer = 'main'
): ResortInfoRecord {
  if (data == null) return {};
  const raw: ResortInfoRecord = !Array.isArray(data)
    ? (data as ResortInfoRecord)
    : (() => {
        const rows = data as ResortInfoRecord[];
        if (rows.length === 0) return {};

        if (prefer === 'room') {
          return (
            rows.find((row) => row.id === 4) ||
            rows.find((row) => String(row.name || '').includes('ห้อง')) ||
            rows[0] ||
            {}
          );
        }

        if (prefer === 'boat') {
          return (
            rows.find((row) => row.id === 5) ||
            rows.find((row) => String(row.name || '').includes('เรือ')) ||
            rows[0] ||
            {}
          );
        }

        return (
          rows.find((row) => row.id === 3) ||
          rows.find(
            (row) =>
              row.payment_due_days != null ||
              row.bank_account_no != null ||
              row.promptpay_id != null
          ) ||
          rows[0] ||
          {}
        );
      })();

  return {
    ...raw,
    name: cleanString(raw.name),
    address: cleanString(raw.address),
    coordinates: cleanString(raw.coordinates),
    phone: cleanString(raw.phone),
    email: cleanString(raw.email),
    facebook: cleanString(raw.facebook),
    line_id: cleanString(raw.line_id),
    operating_days: cleanString(raw.operating_days),
    operating_hours: cleanString(raw.operating_hours),
    additional_terms: cleanString(raw.additional_terms),
    bank_account_no: cleanString(raw.bank_account_no),
    bank_account_name: cleanString(raw.bank_account_name),
    promptpay_id: cleanString(raw.promptpay_id),
  };
}
