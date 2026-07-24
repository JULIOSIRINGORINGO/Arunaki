-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_chat_histories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT,
    "title" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'chat',
    "status" TEXT NOT NULL DEFAULT 'active',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "chat_histories_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_chat_histories" ("createdAt", "id", "mode", "status", "title", "updatedAt", "workspaceId") SELECT "createdAt", "id", "mode", "status", "title", "updatedAt", "workspaceId" FROM "chat_histories";
DROP TABLE "chat_histories";
ALTER TABLE "new_chat_histories" RENAME TO "chat_histories";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
