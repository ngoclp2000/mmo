import 'dotenv/config';
import mysql, {
  type PoolConnection,
  type RowDataPacket,
  type ResultSetHeader,
} from 'mysql2/promise';

export const pool = mysql.createPool({
  uri:
    process.env.DATABASE_URL ??
    'mysql://commerce:commerce_local@127.0.0.1:3306/commerceos',
  connectionLimit: 10,
  timezone: 'Z',
  decimalNumbers: true,
});
export type Db = Pick<PoolConnection, 'execute' | 'query'>;
export async function rows<T extends RowDataPacket>(
  db: Db,
  sql: string,
  values: (string | number | boolean | Date | null)[] = [],
): Promise<T[]> {
  const [result] = await db.execute<T[]>(sql, values);
  return result;
}
export async function write(
  db: Db,
  sql: string,
  values: (string | number | boolean | Date | null)[] = [],
) {
  const [result] = await db.execute<ResultSetHeader>(sql, values);
  return result;
}
export async function transaction<T>(
  fn: (db: PoolConnection) => Promise<T>,
): Promise<T> {
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const result = await fn(db);
    await db.commit();
    return result;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}
