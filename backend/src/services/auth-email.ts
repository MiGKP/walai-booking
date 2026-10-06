/** Preserve mailbox spelling; only legacy Gmail accounts need a fallback. */
export function normalizeAuthEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function legacyAuthEmail(value: string): string {
  const email = normalizeAuthEmail(value);
  const [local, domain] = email.split('@');
  if (domain !== 'gmail.com' && domain !== 'googlemail.com') return email;
  return `${local.split('+')[0].replace(/\./g, '')}@gmail.com`;
}
