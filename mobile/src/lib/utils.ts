export function formatCurrency(amount: number | null | undefined): string {
  const safe = Number.isFinite(amount) ? Number(amount) : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(safe);
}

export function formatRelativeTime(value: string): string {
  const date = new Date(value).getTime();
  const diffMs = Date.now() - date;
  const diffMins = Math.max(1, Math.round(diffMs / 60000));
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function parseInviteTokenFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/join\/([^/?#]+)/i);
    return match?.[1] ?? parsed.searchParams.get('inviteToken');
  } catch {
    const match = String(url).match(/\/join\/([^/?#]+)/i);
    return match?.[1] ?? null;
  }
}

export function validateDateOfBirth(input: string): string | null {
  if (!input) return 'Please enter your date of birth.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return 'Please enter a valid date of birth.';
  const today = new Date().toISOString().slice(0, 10);
  const [year] = input.split('-').map(Number);
  if (year < 1900 || input > today) return 'Please enter a valid date of birth.';
  return null;
}
