type Bucket = {count: number; resetAt: number};

const buckets = new Map<string, Bucket>();

export function consumeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  if (buckets.size > 10_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
  }
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, {count: 1, resetAt: now + windowMs});
    return {allowed: true, remaining: limit - 1};
  }
  if (current.count >= limit) {
    return {allowed: false, remaining: 0, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000)};
  }
  current.count += 1;
  return {allowed: true, remaining: limit - current.count};
}

export function requestClientKey(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('cf-connecting-ip') ??
    'unknown';
}
