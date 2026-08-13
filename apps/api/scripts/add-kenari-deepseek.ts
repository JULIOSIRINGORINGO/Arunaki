import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  // fetch active kenari provider (should be the one with model gpt-oss-120b)
  const active = await prisma.provider.findFirst({ where: { active: true }, orderBy: { priority: 'desc' } });
  if (!active) {
    console.error('No active provider found');
    process.exit(1);
  }
  // Check if a deepseek entry already exists for same baseUrl & apiKey
  const existing = await prisma.provider.findFirst({ where: { baseUrl: active.baseUrl, apiKey: active.apiKey, model: 'deepseek-v4-flash' } });
  if (existing) {
    console.log('Deepseek provider already exists');
    await prisma.$disconnect();
    return;
  }
  // create new provider entry with same baseUrl & apiKey, but different model
  const newProv = await prisma.provider.create({
    data: {
      name: `${active.name} Deepseek`,
      type: active.type,
      baseUrl: active.baseUrl,
      apiKey: active.apiKey,
      model: 'deepseek-v4-flash',
      priority: 0,
      active: true,
    },
  });
  console.log('Created deepseek provider:', newProv.id);
  await prisma.$disconnect();
}

main();