// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// Pure email-format sanity check. Not RFC-compliant; intent is to
// catch typos (missing @, missing domain, spaces). Run AFTER
// canonicalEmail() — canonicalization trims + lowercases, so this
// helper assumes no leading/trailing whitespace and no uppercase.
// Per dispatch §3 acceptance C-list.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailFormat(email: string): boolean {
  if (typeof email !== 'string') return false;
  return EMAIL_RE.test(email);
}
