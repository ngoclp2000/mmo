import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from 'node:crypto';
import { promisify } from 'node:util';
import { pool, rows, write } from './db.js';
import { config } from './config.js';
import { DomainError } from './security.js';
import type { RowDataPacket } from 'mysql2/promise';
const scrypt = promisify(scryptCallback);
export async function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [salt, hash] = encoded.split(':');
  const key = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, 'hex');
  return key.length === expected.length && timingSafeEqual(key, expected);
}
export function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
export interface Session extends RowDataPacket {
  user_id: string;
  csrf_token: string;
  name: string;
  email: string;
}
export async function login(email: string, password: string) {
  const [user] = await rows<RowDataPacket>(
    pool,
    'SELECT id,password_hash FROM users WHERE email=?',
    [email],
  );
  // Equal-cost verification even for unknown accounts.
  const fallback = '00000000000000000000000000000000:' + '00'.repeat(64);
  const valid = await verifyPassword(password, user?.password_hash ?? fallback);
  if (!user || !valid)
    throw new DomainError(401, 'Email hoặc mật khẩu không đúng.');
  const token = randomBytes(32).toString('hex');
  const csrf = randomBytes(32).toString('hex');
  await write(pool, 'DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP(6)');
  await write(pool, 'INSERT INTO sessions VALUES (?,?,?,?)', [
    tokenHash(token),
    user.id,
    csrf,
    new Date(Date.now() + config.sessionSeconds * 1000),
  ]);
  return { token, csrf };
}
export async function getSession(token?: string) {
  if (!token) throw new DomainError(401, 'Vui lòng đăng nhập.');
  const [session] = await rows<Session>(
    pool,
    'SELECT s.user_id,s.csrf_token,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires_at>UTC_TIMESTAMP(6)',
    [tokenHash(token)],
  );
  if (!session) throw new DomainError(401, 'Phiên đăng nhập đã hết hạn.');
  return session;
}
export async function authorize(
  session: Session,
  tenant: string,
  admin = false,
) {
  const [membership] = await rows<RowDataPacket>(
    pool,
    'SELECT role FROM memberships WHERE tenant_id=? AND user_id=?',
    [tenant, session.user_id],
  );
  if (!membership || (admin && membership.role !== 'admin'))
    throw new DomainError(403, 'Bạn không có quyền trong workspace này.');
}
