-- AlterTable
ALTER TABLE "scheduled_reports" ADD COLUMN "goal" TEXT;

-- CreateTable
CREATE TABLE "knowledge_edges" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_edges_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "knowledge" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "knowledge_edges_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "knowledge" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_knowledge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'custom',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "positionX" REAL NOT NULL DEFAULT 0,
    "positionY" REAL NOT NULL DEFAULT 0,
    "nodeColor" TEXT NOT NULL DEFAULT '#3B82F6',
    "icon" TEXT NOT NULL DEFAULT 'file-text',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_knowledge" ("active", "content", "createdAt", "id", "title", "type", "updatedAt") SELECT "active", "content", "createdAt", "id", "title", "type", "updatedAt" FROM "knowledge";
DROP TABLE "knowledge";
ALTER TABLE "new_knowledge" RENAME TO "knowledge";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_edges_sourceId_targetId_key" ON "knowledge_edges"("sourceId", "targetId");
