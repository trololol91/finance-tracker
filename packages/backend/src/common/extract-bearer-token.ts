/**
 * Extracts the token from an `Authorization: Bearer <token>` header. Trims
 * surrounding whitespace and rejects an empty-after-trim result — the single
 * source of truth for this parsing so IatGuard and ApiKeyStrategy can't drift
 * (they previously hand-rolled slightly different versions of this).
 */
export const extractBearerToken = (authHeader: string | undefined): string | null => {
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice('Bearer '.length).trim();
    return token || null;
};
