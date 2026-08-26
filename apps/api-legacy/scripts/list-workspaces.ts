import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const workspaces = await prisma.workspace.findMany({
    select: {
      id: true,
      name: true,
      rootPath: true,
      status: true,
    },
  });

  console.log('📋 Workspaces found:\n');
  workspaces.forEach((ws) => {
    console.log(`ID: ${ws.id}`);
    console.log(`Name: ${ws.name}`);
    console.log(`Path: ${ws.rootPath || '(not connected)'}`);
    console.log(`Status: ${ws.status}`);
    console.log('---');
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());