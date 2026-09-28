const secretKeys = ['password', 'secret', 'token', 'credential'];

export function safeAuditMetadata(metadata: Record<string, string | number | boolean | null> = {}) {
  return Object.fromEntries(Object.entries(metadata).filter(([key]) => !secretKeys.some((word) => key.toLowerCase().includes(word))));
}
