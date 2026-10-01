export function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  if (origin === new URL(request.url).origin) return true;
  const forwardedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (!forwardedHost || !forwardedProto) return false;
  const host = forwardedHost.split(',')[0].trim();
  return origin === `${forwardedProto}://${host}`;
}
