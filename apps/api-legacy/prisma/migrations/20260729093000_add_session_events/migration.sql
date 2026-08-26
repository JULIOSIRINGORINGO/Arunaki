-- CreateTable
CREATE TABLE "session_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "session_events_sessionKey_sequence_idx" ON "session_events"("sessionKey", "sequence");

-- CreateIndex
CREATE INDEX "session_events_sessionKey_createdAt_idx" ON "session_events"("sessionKey", "createdAt");
