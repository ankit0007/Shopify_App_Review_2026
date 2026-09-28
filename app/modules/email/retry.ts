export function classifySmtpFailure(message: string) {
  const text = message.toLowerCase();
  if (text.includes('auth') || text.includes('invalid recipient') || text.includes('mailbox unavailable') || text.includes('not allowed')) {
    return 'permanent' as const;
  }
  return 'transient' as const;
}

export function nextRetryDelayMs(retryCount: number) {
  return Math.min(60 * 60 * 1000, 5 * 60 * 1000 * (2 ** retryCount));
}

export function decideRetry(input: {message: string; retryCount: number; maxRetries: number}) {
  if (classifySmtpFailure(input.message) === 'permanent' || input.retryCount >= input.maxRetries) {
    return {status: 'FAILED' as const, nextAttemptAt: null};
  }
  return {status: 'RETRYING' as const, delayMs: nextRetryDelayMs(input.retryCount)};
}
