/**
 * Seed script: creates test@tabby.com with demo groups for UI testing.
 * Run: npx tsx src/seed.ts
 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from './db.js';

const TEST_EMAIL = 'test@tabby.com';
const TEST_PASSWORD = 'password123';
const TEST_NAME = 'Test User';

function genId() {
  return crypto.randomUUID();
}

function generateCardNumber(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function seed() {
  // Check if test user exists
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(TEST_EMAIL) as { id: string } | undefined;
  if (existing) {
    console.log('Test account already exists. Clearing old demo data...');
    const groups = db.prepare('SELECT id FROM groups WHERE created_by = ?').all(existing.id) as { id: string }[];
    for (const g of groups) {
      db.prepare('DELETE FROM group_members WHERE group_id = ?').run(g.id);
      db.prepare('DELETE FROM virtual_cards WHERE group_id = ?').run(g.id);
      db.prepare('DELETE FROM receipts WHERE group_id = ?').run(g.id);
    }
    db.prepare('DELETE FROM groups WHERE created_by = ?').run(existing.id);
  }

  const userId = existing?.id ?? genId();
  if (!existing) {
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)').run(
      userId,
      TEST_EMAIL,
      passwordHash,
      TEST_NAME
    );
    // Add mock payment method
    db.prepare(
      'INSERT INTO payment_methods (id, user_id, type, last_four, brand) VALUES (?, ?, ?, ?, ?)'
    ).run(genId(), userId, 'card', '4242', 'Visa');
    console.log('Created test user:', TEST_EMAIL);
  }

  // Create demo groups
  const demoGroups = [
    { name: 'Lunch Squad', members: 4 },
    { name: 'Roommates', members: 3 },
    { name: 'Road Trip 2026', members: 6 },
  ];

  for (const g of demoGroups) {
    const groupId = genId();
    const cardLastFour = generateCardNumber();
    db.prepare('INSERT INTO groups (id, name, created_by) VALUES (?, ?, ?)').run(groupId, g.name, userId);
    db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(groupId, userId);
    db.prepare('INSERT INTO virtual_cards (id, group_id, card_number_last_four) VALUES (?, ?, ?)').run(
      genId(),
      groupId,
      cardLastFour
    );
    console.log(`  Created group: ${g.name} (card •••• ${cardLastFour})`);
  }

  console.log('\nTest account ready:');
  console.log(`  Email: ${TEST_EMAIL}`);
  console.log(`  Password: ${TEST_PASSWORD}`);
}

seed().catch(console.error);
