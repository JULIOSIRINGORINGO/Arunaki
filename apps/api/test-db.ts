import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const msgs = await prisma.message.findMany({
    where: { chatHistoryId: 'cmt470qcb0001vgbg25x0z1qq' },
    orderBy: { createdAt: 'asc' }
  });
  
  for (const m of msgs) {
    console.log(`[${m.role}] ID: ${m.id}`);
    console.log(`Content: ${m.content}`);
    const meta = m.metadata ? JSON.parse(m.metadata) : {};
    if (meta.toolCalls) {
      console.log(`Tool Calls: ${JSON.stringify(meta.toolCalls, null, 2)}`);
    }
    if (meta.toolResults) {
      console.log(`Tool Results: ${JSON.stringify(meta.toolResults, null, 2)}`);
    }
    console.log('-----------------');
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
