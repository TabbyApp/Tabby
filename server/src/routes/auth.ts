import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../middleware/auth.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const OTP_LENGTH = 6;

function genId() {
  return crypto.randomUUID();
}

/** Normalize to E.164: digits only; 10 digits => +1 (US); 11 starting with 1 => +1 */
function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  if (digits.length >= 10) return '+' + digits;
  return '';
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

authRouter.post('/signup', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const id = genId();
  const passwordHash = await bcrypt.hash(password, 10);

  db.prepare(
    'INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)'
  ).run(id, email.toLowerCase().trim(), passwordHash, name.trim());

  const accessToken = signAccessToken({ userId: id, email: email.toLowerCase() });
  const refreshToken = signRefreshToken({ userId: id, email: email.toLowerCase() });
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)'
  ).run(genId(), id, tokenHash, expiresAt);

  res
    .cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .json({
      accessToken,
      expiresIn: 15 * 60,
      user: { id, email: email.toLowerCase(), name: name.trim() },
    });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.prepare(
    'SELECT id, email, password_hash, name FROM users WHERE email = ?'
  ).get(email.toLowerCase()) as { id: string; email: string; password_hash: string; name: string } | undefined;

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const accessToken = signAccessToken({ userId: user.id, email: user.email });
  const refreshToken = signRefreshToken({ userId: user.id, email: user.email });
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)'
  ).run(genId(), user.id, tokenHash, expiresAt);

  res
    .cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .json({
      accessToken,
      expiresIn: 15 * 60,
      user: { id: user.id, email: user.email, name: user.name },
    });
});

authRouter.post('/refresh', (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!token) {
    return res.status(401).json({ error: 'Refresh token required' });
  }

  const payload = verifyRefreshToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const row = db.prepare(
    "SELECT id FROM refresh_tokens WHERE token_hash = ? AND expires_at > datetime('now')"
  ).get(tokenHash) as { id: string } | undefined;

  if (!row) {
    return res.status(401).json({ error: 'Refresh token expired or revoked' });
  }

  const accessToken = signAccessToken({ userId: payload.userId, email: payload.email });

  res.json({ accessToken, expiresIn: 15 * 60 });
});

authRouter.post('/logout', (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(tokenHash);
  }
  res.clearCookie('refreshToken').json({ ok: true });
});

// Send OTP to phone using Twilio Verify (or fallback to manual for dev). In dev without Twilio, returns code in response.
authRouter.post('/send-otp', async (req, res) => {
  const { phone } = req.body;
  const raw = typeof phone === 'string' ? phone.trim() : '';
  if (!raw) {
    return res.status(400).json({ error: 'Phone number is required' });
  }
  const normalized = normalizePhone(raw);
  if (!normalized) {
    return res.status(400).json({ error: 'Invalid phone number. Use 10+ digits (e.g. 5551234567 or +15551234567).' });
  }

  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  // Use Twilio Verify API if configured
  if (twilioAccountSid && twilioAuthToken && verifyServiceSid) {
    try {
      const twilio = (await import('twilio')).default;
      const client = twilio(twilioAccountSid, twilioAuthToken);
      
      // Ensure Verify Service Friendly Name is set to "Tabby" (updates if needed)
      try {
        await client.verify.v2.services(verifyServiceSid).update({
          friendlyName: 'Tabby',
        });
      } catch (updateErr) {
        // Ignore update errors (might not have permissions or already set)
      }
      
      await client.verify.v2.services(verifyServiceSid).verifications.create({
        to: normalized,
        channel: 'sms',
      });
      return res.json({ ok: true, message: 'Code sent via SMS.' });
    } catch (err: any) {
      console.error('Twilio Verify send failed:', err?.message);
      return res.status(500).json({ error: 'Failed to send code. Please try again.' });
    }
  }

  // Fallback: manual code generation (dev mode)
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();
  db.prepare(
    'INSERT INTO phone_otps (phone, code, expires_at) VALUES (?, ?, ?) ON CONFLICT(phone) DO UPDATE SET code = ?, expires_at = ?'
  ).run(normalized, code, expiresAt, code, expiresAt);
  console.log(`[OTP DEV] ${normalized} => ${code} (expires ${expiresAt})`);
  res.json({
    ok: true,
    message: 'Code sent (dev mode).',
    code, // Return code in dev mode
  });
});

// Verify OTP and sign in or sign up. New users must send name.
authRouter.post('/verify-otp', async (req, res) => {
  const { phone, code, name } = req.body;
  const raw = typeof phone === 'string' ? phone.trim() : '';
  if (!raw || !code) {
    return res.status(400).json({ error: 'Phone and code are required' });
  }
  const normalized = normalizePhone(raw);
  if (!normalized) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }

  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  // Use Twilio Verify API if configured
  if (twilioAccountSid && twilioAuthToken && verifyServiceSid) {
    try {
      const twilio = (await import('twilio')).default;
      const client = twilio(twilioAccountSid, twilioAuthToken);
      const verificationCheck = await client.verify.v2.services(verifyServiceSid).verificationChecks.create({
        to: normalized,
        code: String(code).trim(),
      });

      if (verificationCheck.status !== 'approved') {
        return res.status(400).json({ error: 'Invalid or expired code' });
      }
      // Code verified by Twilio, continue to sign in/sign up
    } catch (err: any) {
      console.error('Twilio Verify check failed:', err?.message);
      return res.status(400).json({ error: 'Invalid or expired code' });
    }
  } else {
    // Fallback: manual code verification (dev mode)
    const row = db.prepare(
      'SELECT code, expires_at FROM phone_otps WHERE phone = ?'
    ).get(normalized) as { code: string; expires_at: string } | undefined;

    if (!row || row.code !== String(code).trim()) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }
    if (new Date(row.expires_at) < new Date()) {
      db.prepare('DELETE FROM phone_otps WHERE phone = ?').run(normalized);
      return res.status(400).json({ error: 'Code expired. Request a new one.' });
    }
    // Delete used code
    db.prepare('DELETE FROM phone_otps WHERE phone = ?').run(normalized);
  }

  let user = db.prepare(
    'SELECT id, email, name, phone FROM users WHERE phone = ?'
  ).get(normalized) as { id: string; email: string; name: string; phone: string | null } | undefined;

  if (!user) {
    const nameStr = typeof name === 'string' ? name.trim() : '';
    if (!nameStr || nameStr.length < 2) {
      return res.status(400).json({ error: 'Name is required for new accounts (at least 2 characters)' });
    }
    const id = genId();
    const placeholderEmail = `p${normalized.replace(/\D/g, '')}@phone.tabby.local`;
    const passwordPlaceholder = crypto.randomBytes(32).toString('hex');
    db.prepare(
      'INSERT INTO users (id, email, password_hash, name, phone) VALUES (?, ?, ?, ?, ?)'
    ).run(id, placeholderEmail, passwordPlaceholder, nameStr, normalized);
    user = db.prepare(
      'SELECT id, email, name, phone FROM users WHERE id = ?'
    ).get(id) as { id: string; email: string; name: string; phone: string | null };
  }

  const accessToken = signAccessToken({ userId: user.id, email: user.email });
  const refreshToken = signRefreshToken({ userId: user.id, email: user.email });
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)'
  ).run(genId(), user.id, tokenHash, expiresAt);

  // Auto-join groups with pending phone invites for this phone number
  const pendingInvites = db.prepare(
    'SELECT id, group_id FROM phone_invites WHERE invitee_phone = ? AND status = ?'
  ).all(normalized, 'pending') as { id: string; group_id: string }[];

  for (const invite of pendingInvites) {
    db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').run(invite.group_id, user.id);
    db.prepare('UPDATE phone_invites SET status = ? WHERE id = ?').run('accepted', invite.id);
  }

  res
    .cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .json({
      accessToken,
      expiresIn: 15 * 60,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone ?? undefined,
      },
    });
});
