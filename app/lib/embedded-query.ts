const EMBEDDED_QUERY_KEYS = ['shop', 'host', 'embedded', 'locale', 'session', 'id_token', 'hmac', 'timestamp'] as const;

export function withEmbeddedQuery(href: string, current: URLSearchParams) {
  const url = new URL(href, 'https://app.local');
  for (const key of EMBEDDED_QUERY_KEYS) {
    const value = current.get(key);
    if (value && !url.searchParams.has(key)) url.searchParams.set(key, value);
  }
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ''}`;
}

export function embeddedFields(current: URLSearchParams) {
  return EMBEDDED_QUERY_KEYS.flatMap((key) => {
    const value = current.get(key);
    return value ? [{key, value}] : [];
  });
}
