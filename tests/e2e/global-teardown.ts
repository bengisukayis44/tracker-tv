import "dotenv/config";
import { Client } from "pg";

/** Deletes the Supabase Auth users created by the tests; a trigger removes their profiles too. */
export default async function globalTeardown() {
  if (!process.env.DIRECT_URL) return;
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();
  try {
    const { rowCount } = await client.query(`DELETE FROM auth.users WHERE email LIKE '%@e2e.test'`);
    if (rowCount) console.log(`Test kullanıcıları silindi: ${rowCount}`);
  } finally {
    await client.end();
  }
}
