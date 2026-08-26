import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

const model = process.argv[2] || 'gemini-2-5-flash';
for (const dbPath of ['apps/api/prisma/dev.db', 'apps/api/dev.db']) {
  if (fs.existsSync(dbPath)) {
    const db = new DatabaseSync(dbPath);
    try {
      db.prepare("UPDATE providers SET model = ?, cooldownUntil = NULL WHERE id = 'kenari'").run(model);
      const p = db.prepare("SELECT id, name, model, active, cooldownUntil FROM providers WHERE id = 'kenari'").get();
      console.log(`Current Kenari DB state in ${dbPath}:`, JSON.stringify(p, null, 2));
    } catch (e: any) {
      console.log(`Failed on ${dbPath}:`, e.message);
    }
  }
}
