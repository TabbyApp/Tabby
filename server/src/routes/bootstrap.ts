import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const bootstrapRouter = Router();

/** Single request for initial app load: user + groups + virtual cards. Replaces 3 round-trips. */
bootstrapRouter.get('/', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;

  const [userRes, groupsRes, cardsRes] = await Promise.all([
    query<{ id: string; email: string; name: string; phone: string; created_at: string; bank_linked: boolean; payment_methods_json: string | null }>(`
      SELECT u.id, u.email, u.name, COALESCE(u.phone, '') as phone, u.created_at, COALESCE(u.bank_linked, false) as bank_linked,
             (SELECT json_agg(json_build_object('id', id, 'type', type, 'last_four', last_four, 'brand', brand, 'created_at', created_at))
              FROM payment_methods WHERE user_id = u.id)::text as payment_methods_json
      FROM users u WHERE u.id = $1
    `, [userId]),
    query<{ id: string; name: string; created_by: string; created_at: string; card_number_last_four: string | null; member_count: string }>(`
      SELECT g.id, g.name, g.created_by, g.created_at,
             vc.card_number_last_four,
             (SELECT COUNT(*)::text FROM group_members WHERE group_id = g.id) as member_count
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id
      LEFT JOIN virtual_cards vc ON g.id = vc.group_id
      WHERE gm.user_id = $1
      ORDER BY g.created_at DESC
    `, [userId]),
    query<{ groupId: string; groupName: string; cardLastFour: string | null; groupTotal: number }>(`
      WITH receipt_totals AS (
        SELECT r.group_id,
          COALESCE(r.total, (SELECT COALESCE(SUM(price), 0) FROM receipt_items WHERE receipt_id = r.id)) AS total
        FROM receipts r
        WHERE r.status = 'completed'
      ),
      group_totals AS (
        SELECT group_id, COALESCE(SUM(total), 0) AS total FROM receipt_totals GROUP BY group_id
      )
      SELECT g.id AS "groupId", g.name AS "groupName", vc.card_number_last_four AS "cardLastFour",
             COALESCE(gt.total, 0)::float AS "groupTotal"
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id
      LEFT JOIN virtual_cards vc ON g.id = vc.group_id
      LEFT JOIN group_totals gt ON g.id = gt.group_id
      WHERE gm.user_id = $1
      ORDER BY g.created_at DESC
    `, [userId]),
  ]);

  const userRow = userRes.rows[0];
  if (!userRow) return res.status(404).json({ error: 'User not found' });

  let paymentMethods: { id: string; type: string; last_four: string; brand: string | null; created_at: string }[] = [];
  if (userRow.payment_methods_json && userRow.payment_methods_json !== 'null') {
    try {
      const parsed = JSON.parse(userRow.payment_methods_json);
      paymentMethods = Array.isArray(parsed) ? parsed : parsed != null ? [parsed] : [];
    } catch { /* fallback */ }
  }

  const groups = groupsRes.rows.map((g) => ({
    id: g.id,
    name: g.name,
    memberCount: parseInt(g.member_count, 10),
    cardLastFour: g.card_number_last_four,
    createdAt: g.created_at,
  }));

  const virtualCards = cardsRes.rows.map((c) => ({
    ...c,
    active: true,
    groupTotal: c.groupTotal ?? 0,
  }));

  res.json({
    user: {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      phone: userRow.phone,
      created_at: userRow.created_at,
      bank_linked: !!userRow.bank_linked,
      paymentMethods: paymentMethods.filter((p) => p != null),
    },
    groups,
    virtualCards,
  });
});
