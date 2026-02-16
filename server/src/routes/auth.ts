import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../db.js';
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

  const { rows: existingRows } = await query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existingRows.length > 0) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const id = genId();
  const rounds = process.env.NODE_ENV === 'production' ? 10 : 4; // Faster in dev
  const passwordHash = await bcrypt.hash(password, rounds);

  await query(
    'INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4)',
    [id, email.toLowerCase().trim(), passwordHash, name.trim()]
  );

  const accessToken = signAccessToken({ userId: id, email: email.toLowerCase() });
  const refreshToken = signRefreshToken({ userId: id, email: email.toLowerCase() });
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await query(
    'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
    [genId(), id, tokenHash, expiresAt]
  );

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

  const { rows: userRows } = await query<{ id: string; email: string; password_hash: string; name: string }>(
    'SELECT id, email, password_hash, name FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  const user = userRows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const accessToken = signAccessToken({ userId: user.id, email: user.email });
  const refreshToken = signRefreshToken({ userId: user.id, email: user.email });
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await query(
    'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
    [genId(), user.id, tokenHash, expiresAt]
  );

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

authRouter.post('/refresh', async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!token) {
    return res.status(401).json({ error: 'Refresh token required' });
  }

  const payload = verifyRefreshToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const { rows } = await query<{ id: string }>(
    "SELECT id FROM refresh_tokens WHERE token_hash = $1 AND expires_at > now()",
    [tokenHash]
  );
  const row = rows[0];

  if (!row) {
    return res.status(401).json({ error: 'Refresh token expired or revoked' });
  }

  const accessToken = signAccessToken({ userId: payload.userId, email: payload.email });

  res.json({ accessToken, expiresIn: 15 * 60 });
});

authRouter.post('/logout', async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
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
  await query(
    'INSERT INTO phone_otps (phone, code, expires_at) VALUES ($1, $2, $3) ON CONFLICT(phone) DO UPDATE SET code = $4, expires_at = $5',
    [normalized, code, expiresAt, code, expiresAt]
  );
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
    const { rows: otpRows } = await query<{ code: string; expires_at: string }>(
      'SELECT code, expires_at FROM phone_otps WHERE phone = $1',
      [normalized]
    );
    const row = otpRows[0];

    if (!row || row.code !== String(code).trim()) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }
    if (new Date(row.expires_at) < new Date()) {
      await query('DELETE FROM phone_otps WHERE phone = $1', [normalized]);
      return res.status(400).json({ error: 'Code expired. Request a new one.' });
    }
    // Delete used code
    await query('DELETE FROM phone_otps WHERE phone = $1', [normalized]);
  }

  let { rows: userRows } = await query<{ id: string; email: string; name: string; phone: string | null }>(
    'SELECT id, email, name, phone FROM users WHERE phone = $1',
    [normalized]
  );
  let user = userRows[0];

  if (!user) {
    const nameStr = typeof name === 'string' ? name.trim() : '';
    if (!nameStr || nameStr.length < 2) {
      return res.status(400).json({ error: 'Name is required for new accounts (at least 2 characters)' });
    }
    const id = genId();
    const placeholderEmail = `p${normalized.replace(/\D/g, '')}@phone.tabby.local`;
    const passwordPlaceholder = crypto.randomBytes(32).toString('hex');
    await query(
      'INSERT INTO users (id, email, password_hash, name, phone) VALUES ($1, $2, $3, $4, $5)',
      [id, placeholderEmail, passwordPlaceholder, nameStr, normalized]
    );
    const { rows: newUserRows } = await query<{ id: string; email: string; name: string; phone: string | null }>(
      'SELECT id, email, name, phone FROM users WHERE id = $1',
      [id]
    );
    user = newUserRows[0]!;
  }

  const accessToken = signAccessToken({ userId: user.id, email: user.email });
  const refreshToken = signRefreshToken({ userId: user.id, email: user.email });
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await query(
    'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
    [genId(), user.id, tokenHash, expiresAt]
  );

  // Auto-join groups with pending phone invites for this phone number
  const { rows: pendingInvites } = await query<{ id: string; group_id: string }>(
    'SELECT id, group_id FROM phone_invites WHERE invitee_phone = $1 AND status = $2',
    [normalized, 'pending']
  );

  for (const invite of pendingInvites) {
    await query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT (group_id, user_id) DO NOTHING', [invite.group_id, user.id]);
    await query('UPDATE phone_invites SET status = $1 WHERE id = $2', ['accepted', invite.id]);
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
