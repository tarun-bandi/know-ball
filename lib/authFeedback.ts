const AUTH_TIMEOUT_MS = 10000;

function isLocalSupabaseUrl() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  return url.includes('localhost') || url.includes('127.0.0.1');
}

export function getAuthErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (
    isLocalSupabaseUrl() &&
    (normalized.includes('failed to fetch') ||
      normalized.includes('network request failed') ||
      normalized.includes('timeout') ||
      normalized.includes('load failed'))
  ) {
    return 'Auth is pointed at local Supabase, but it is not reachable. Start Supabase locally or replace the .env values with your real Supabase URL and anon key.';
  }

  return message || 'Something went wrong. Please try again.';
}

export async function withAuthTimeout<T>(promise: Promise<T>) {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Auth request timed out'));
    }, AUTH_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId!);
  }
}
