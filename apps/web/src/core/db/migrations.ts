import { db } from './db';

export async function runMigrations() {
  await db.open();
}
