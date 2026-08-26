export function sanitizeSensitiveString(text: string): string {
  if (!text) return '';
  return text
    .replace(/(password["':\s=]+)([^"'\s&,]+)/gi, '$1***REDACTED***')
    .replace(/(token["':\s=]+)([^"'\s&,]+)/gi, '$1***REDACTED***')
    .replace(/(auth_token["':\s=]+)([^"'\s&,]+)/gi, '$1***REDACTED***')
    .replace(/(proxy_pass["':\s=]+)([^"'\s&,]+)/gi, '$1***REDACTED***')
    .replace(/(secret["':\s=]+)([^"'\s&,]+)/gi, '$1***REDACTED***');
}

export function sanitizeError(err: unknown): string {
  if (err instanceof Error) {
    return sanitizeSensitiveString(err.message);
  }
  return sanitizeSensitiveString(String(err));
}

export function sanitizeObject<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  try {
    const json = JSON.stringify(obj, (key, value) => {
      if (typeof key === 'string' && /password|token|secret|apiKey/i.test(key)) {
        return '***REDACTED***';
      }
      return value;
    });
    return JSON.parse(json);
  } catch {
    return obj;
  }
}
