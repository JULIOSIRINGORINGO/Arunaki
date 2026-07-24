-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "workspace_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "totalSizeMb" REAL NOT NULL DEFAULT 0,
    "fileTypes" TEXT NOT NULL DEFAULT '{}',
    "oldestFile" TEXT,
    "newestFile" TEXT,
    "primaryLanguage" TEXT,
    "secondaryLanguages" TEXT NOT NULL DEFAULT '[]',
    "topics" TEXT NOT NULL DEFAULT '[]',
    "documentTypes" TEXT NOT NULL DEFAULT '[]',
    "departments" TEXT NOT NULL DEFAULT '[]',
    "timeRange" TEXT,
    "dataSources" TEXT NOT NULL DEFAULT '[]',
    "fileLinks" INTEGER NOT NULL DEFAULT 0,
    "crossReferences" INTEGER NOT NULL DEFAULT 0,
    "dataDependencies" INTEGER NOT NULL DEFAULT 0,
    "recommendations" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "workspace_profiles_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "sources_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "content" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "files_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "file_metadata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileId" TEXT NOT NULL,
    "title" TEXT,
    "author" TEXT,
    "subject" TEXT,
    "keywords" TEXT,
    "language" TEXT,
    "pageCount" INTEGER,
    "wordCount" INTEGER,
    "charCount" INTEGER,
    "sheetCount" INTEGER,
    "sheetNames" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "exifData" TEXT,
    "parsedAt" DATETIME,
    "indexedAt" DATETIME,
    "parseErrors" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "file_metadata_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "chat_histories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT,
    "title" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'chat',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "chat_histories_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatHistoryId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_chatHistoryId_fkey" FOREIGN KEY ("chatHistoryId") REFERENCES "chat_histories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "artifacts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "size" INTEGER,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "preview" TEXT,
    "sourceFiles" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "artifacts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'success',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_profiles_workspaceId_key" ON "workspace_profiles"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "file_metadata_fileId_key" ON "file_metadata"("fileId");
