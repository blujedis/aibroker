import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db/postgres.js';

export async function getGlobalSettings(): Promise<{ globalMfaEnabled: boolean }> {
  const rows = await db
    .select()
    .from(schema.instanceSettings)
    .where(eq(schema.instanceSettings.id, 'global'))
    .limit(1);

  const row = rows[0];

  if (!row) {
    await db.insert(schema.instanceSettings)
      .values({ id: 'global', globalMfaEnabled: false, updatedAt: new Date() })
      .execute();
    return { globalMfaEnabled: false };
  }

  return { globalMfaEnabled: row.globalMfaEnabled };
}

export async function setGlobalMfaEnabled(enabled: boolean): Promise<void> {
  await db.update(schema.instanceSettings)
    .set({ globalMfaEnabled: enabled, updatedAt: new Date() })
    .where(eq(schema.instanceSettings.id, 'global'));
}
