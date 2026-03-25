import { query } from './db';

/** Single local row — all list CRUD runs as this user (no OAuth). */
const LOCAL_USER_EXTERNAL_ID = 'local-demo';

let cachedUserId: string | null = null;

export async function getDemoUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;

  const existing = await query(`SELECT id FROM users WHERE spotify_id = $1`, [LOCAL_USER_EXTERNAL_ID]);

  if (existing.rows.length > 0) {
    cachedUserId = (existing.rows[0] as { id: string }).id;
    return cachedUserId;
  }

  const inserted = await query(
    `INSERT INTO users (spotify_id, username, display_name)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [LOCAL_USER_EXTERNAL_ID, 'local', 'Local']
  );

  cachedUserId = (inserted.rows[0] as { id: string }).id;
  return cachedUserId;
}
