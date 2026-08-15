import 'dotenv/config';
import { SecretsVaultService } from '../src/modules/security/secrets-vault.service.js';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';

async function main() {
  const dbPath = path.resolve(process.cwd(), 'apps/api/prisma/dev.db');
  const db = new DatabaseSync(dbPath);
  const provider: any = db.prepare("SELECT apiKey FROM providers WHERE id = 'kenari'").get();
  const vault = new SecretsVaultService();
  const decryptedKey = vault.decryptSecret(JSON.parse(provider.apiKey));

  const res = await fetch('https://kenari.id/v1/models', {
    headers: { Authorization: 'Bearer ' + decryptedKey }
  });
  const data = await res.json();
  const list = data.data.map((m: any) => ({
    id: m.id,
    tool_call: m.tool_call,
    reasoning: m.reasoning,
    reasoning_toggle: m.reasoning_toggle,
    reasoning_options: m.reasoning_options,
  }));
  console.log(JSON.stringify(list, null, 2));
}

main().catch(console.error);
