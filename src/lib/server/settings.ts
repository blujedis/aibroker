import { eq } from 'drizzle-orm';
import { db, schema } from '$lib/server/db/index.js';

export function getGlobalSettings(): { globalMfaEnabled: boolean } {
  const row = db
    .select()
    .from(schema.instanceSettings)
    .where(eq(schema.instanceSettings.id, 'global'))
    .get();

  if (!row) {
    db.insert(schema.instanceSettings)
      .values({ id: 'global', globalMfaEnabled: false, updatedAt: new Date() })
      .run();
    return { globalMfaEnabled: false };
  }

  return { globalMfaEnabled: row.globalMfaEnabled };
}

export function setGlobalMfaEnabled(enabled: boolean): void {
  db.update(schema.instanceSettings)
    .set({ globalMfaEnabled: enabled, updatedAt: new Date() })
    .where(eq(schema.instanceSettings.id, 'global'))
    .run();
}
