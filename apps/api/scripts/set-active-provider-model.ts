import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const active = await prisma.provider.findFirst({
    where: { active: true },
    orderBy: { priority: 'desc' },
  });
  if (!active) {
    console.log('No active provider found');
    process.exit(1);
  }
  console.log('BEFORE:', JSON.stringify({ id: active.id, name: active.name, baseUrl: active.baseUrl, model: active.model }));
  await prisma.provider.update({ where: { id: active.id }, data: { model: 'gpt-oss-120b' } });
  const after = await prisma.provider.findUnique({ where: { id: active.id } });
  console.log('AFTER:', JSON.stringify({ name: after?.name, baseUrl: after?.baseUrl, model: after?.model, active: after?.active }));
  await prisma.$disconnect();
}

main();
