-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "content" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "successRate" REAL NOT NULL DEFAULT 1.0,
    "sourceType" TEXT NOT NULL DEFAULT 'auto',
    "sourceInfo" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "memories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL DEFAULT 'preference',
    "key" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'auto',
    "importance" INTEGER NOT NULL DEFAULT 5,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessed" DATETIME,
    "workspaceId" TEXT,
    "sessionId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "providers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "headerPrefix" TEXT,
    "headerTitle" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" DATETIME,
    "lastErrorAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_artifacts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "path" TEXT,
    "size" INTEGER,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "preview" TEXT,
    "sourceFiles" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "artifacts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_artifacts" ("createdAt", "format", "id", "metadata", "name", "path", "preview", "size", "sourceFiles", "type", "updatedAt", "workspaceId") SELECT "createdAt", "format", "id", "metadata", "name", "path", "preview", "size", "sourceFiles", "type", "updatedAt", "workspaceId" FROM "artifacts";
DROP TABLE "artifacts";
ALTER TABLE "new_artifacts" RENAME TO "artifacts";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "skills_name_key" ON "skills"("name");

-- CreateIndex
CREATE UNIQUE INDEX "memories_type_key_key" ON "memories"("type", "key");
