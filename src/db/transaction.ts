import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "@/db/schema";

export async function withTransaction<T>(
  callback: (tx: any) => Promise<T>
): Promise<T> {
  const connectionString = process.env.DATABASE_URL || "postgresql://mock:mock@localhost:5432/mock";

  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  try {
    return await db.transaction(callback);
  } finally {
    await pool.end();
  }
}
