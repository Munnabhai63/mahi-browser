export interface ParsedProxyString {
  protocol: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
}

/**
 * Parses common proxy formats:
 * - host:port
 * - host:port:user:pass
 * - protocol://host:port
 * - protocol://user:pass@host:port
 */
export function parseProxyString(raw: string): ParsedProxyString | null {
  let s = raw.trim();
  if (!s) return null;

  s = s.replace(/^["']|["']$/g, '').trim();

  let protocol = 'http';
  let rest = s;

  const protoMatch = rest.match(/^(https?|socks[45]?):\/\//i);
  if (protoMatch) {
    protocol = protoMatch[1].toLowerCase();
    rest = rest.slice(protoMatch[0].length);
  }

  const atIdx = rest.indexOf('@');
  let username: string | undefined;
  let password: string | undefined;
  if (atIdx > 0) {
    const creds = rest.slice(0, atIdx);
    rest = rest.slice(atIdx + 1);
    const colonIdx = creds.indexOf(':');
    if (colonIdx > -1) {
      username = creds.slice(0, colonIdx);
      password = creds.slice(colonIdx + 1);
    } else {
      username = creds;
    }
  }

  const parts = rest.split(':');
  if (parts.length < 2) return null;

  const host = parts[0].trim();
  const port = parseInt(parts[1].trim(), 10);
  if (!host || isNaN(port)) return null;

  if (parts.length >= 4 && !username) {
    username = parts[2].trim();
    password = parts.slice(3).join(':').trim();
  }

  return { protocol, host, port, username, password };
}
