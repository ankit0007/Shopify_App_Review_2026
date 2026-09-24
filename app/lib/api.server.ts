export function ok<T>(data: T, init?: ResponseInit) {
  return Response.json({success: true, data}, init);
}

export function fail(code: string, message: string, status = 400) {
  return Response.json({success: false, error: {code, message}}, {status});
}

export function safeError(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected error';
}
