/**
 * WebSocket URL for Socket.io (same host as API).
 * Uses VITE_API_URL when set (e.g. https://your-api.onrender.com → wss://your-api.onrender.com).
 * Otherwise same origin (window.location) or ws://localhost:3001 for dev.
 */
export function getSocketUrl(): string {
  if (typeof window === 'undefined') return '';
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl && typeof apiUrl === 'string' && (apiUrl.startsWith('http://') || apiUrl.startsWith('https://'))) {
    const u = new URL(apiUrl);
    const protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${u.host}`;
  }
  const { protocol, host } = window.location;
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${host}`;
}
