import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pool, rows, write } from './db.js';
import type { RowDataPacket } from 'mysql2/promise';
const db = await pool.getConnection();
try {
  const [lock] = await rows<RowDataPacket>(
    db,
    "SELECT GET_LOCK('commerceos_migration',30) acquired",
  );
  if (lock.acquired !== 1) throw new Error('Migration lock unavailable');
  await write(
    db,
    'CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(80) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at DATETIME(6) NOT NULL)',
  );
  const sql = await readFile('infra/001-initial.sql', 'utf8');
  const checksum = createHash('sha256').update(sql).digest('hex');
  const [applied] = await rows<RowDataPacket>(
    db,
    'SELECT checksum FROM schema_migrations WHERE version=?',
    ['001-initial'],
  );
  if (applied && applied.checksum !== checksum)
    throw new Error('Applied migration changed; add a new migration instead');
  if (!applied) {
    // MySQL DDL auto-commits. A partial migration fails visibly; reset disposable demo DB before retry.
    for (const statement of sql
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean))
      await db.query(statement);
    await write(
      db,
      'INSERT INTO schema_migrations VALUES (?,?,UTC_TIMESTAMP(6))',
      ['001-initial', checksum],
    );
  }
  console.log('Migration 001-initial ready');
} finally {
  await db.query("SELECT RELEASE_LOCK('commerceos_migration')");
  db.release();
  await pool.end();
}
