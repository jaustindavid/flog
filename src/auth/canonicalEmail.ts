// flog — Copyright © 2026 Austin David — PolyForm Noncommercial 1.0.0

// Boundary normalization for email addresses.
//
// Used wherever an email enters the system from user input or
// auth-provided tokens. Google OAuth tokens are typically canonical
// already, but we normalize defensively so the rules-side equality
// checks and Firestore doc-id lookups stay consistent.
//
// See AGENTS.md "Email canonicalization happens at the boundary" and
// PRD §5.4.

export function canonicalEmail(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.trim().toLowerCase();
}
