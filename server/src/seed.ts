/**
 * Seed script: creates test@tabby.com with demo groups for UI testing.
 * Run: npm run seed (or tsx src/seed.ts)
 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from './db.js';

const TEST_EMAIL = 'test@tabby.com';
const TEST_PASSWORD = 'password123';
const TEST_NAME = 'Test User';

const TEST2_EMAIL = 'test2@tabby.com';
const TEST2_PASSWORD = 'password123';
const TEST2_NAME = 'Test User 2';

function genId() {
  return crypto.randomUUID();
}

function generateCardNumber(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function seed() {
  const rounds = process.env.NODE_ENV === 'production' ? 10 : 4;
  const { rows: existingRows } = await query<{ id: string }>('SELECT id FROM users WHERE email = $1', [TEST_EMAIL]);
  const existing = existingRows[0];

  if (existing) {
    console.log('Test account already exists. Clearing old demo data...');
    const { rows: groups } = await query<{ id: string }>('SELECT id FROM groups WHERE created_by = $1', [existing.id]);
    for (const g of groups) {
      await query('DELETE FROM group_members WHERE group_id = $1', [g.id]);
      await query('DELETE FROM virtual_cards WHERE group_id = $1', [g.id]);
      await query('DELETE FROM receipts WHERE group_id = $1', [g.id]);
    }
    await query('DELETE FROM groups WHERE created_by = $1', [existing.id]);
  }

  const userId = existing?.id ?? genId();
  if (!existing) {
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, rounds);
    await query('INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4)', [
      userId,
      TEST_EMAIL,
      passwordHash,
      TEST_NAME,
    ]);
    await query(
      'INSERT INTO payment_methods (id, user_id, type, last_four, brand) VALUES ($1, $2, $3, $4, $5)',
      [genId(), userId, 'card', '4242', 'Visa']
    );
    console.log('Created test user:', TEST_EMAIL);
  }

  const demoGroups = [
    { name: 'Lunch Squad', members: 4 },
    { name: 'Roommates', members: 3 },
    { name: 'Road Trip 2026', members: 6 },
  ];

  for (const g of demoGroups) {
    const groupId = genId();
    const cardLastFour = generateCardNumber();
    await query('INSERT INTO groups (id, name, created_by) VALUES ($1, $2, $3)', [groupId, g.name, userId]);
    await query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [groupId, userId]);
    await query('INSERT INTO virtual_cards (id, group_id, card_number_last_four) VALUES ($1, $2, $3)', [
      genId(),
      groupId,
      cardLastFour,
    ]);
    console.log(`  Created group: ${g.name} (card •••• ${cardLastFour})`);
  }

  const { rows: existing2Rows } = await query<{ id: string }>('SELECT id FROM users WHERE email = $1', [TEST2_EMAIL]);
  const existing2 = existing2Rows[0];
  if (!existing2) {
    const user2Id = genId();
    const passwordHash2 = await bcrypt.hash(TEST2_PASSWORD, rounds);
    await query('INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4)', [
      user2Id,
      TEST2_EMAIL,
      passwordHash2,
      TEST2_NAME,
    ]);
    await query(
      'INSERT INTO payment_methods (id, user_id, type, last_four, brand) VALUES ($1, $2, $3, $4, $5)',
      [genId(), user2Id, 'card', '5555', 'Visa']
    );
    console.log('Created second test user:', TEST2_EMAIL);
  }

  console.log('\nTest accounts ready:');
  console.log(`  ${TEST_EMAIL} / ${TEST_PASSWORD}`);
  console.log(`  ${TEST2_EMAIL} / ${TEST2_PASSWORD}`);
  console.log('\nTo test invites: log in as test@tabby.com, create a group, tap Invite and copy the link.');
  console.log('Open the link in an Incognito window and log in as test2@tabby.com to accept.');
}

seed().catch(console.error);
