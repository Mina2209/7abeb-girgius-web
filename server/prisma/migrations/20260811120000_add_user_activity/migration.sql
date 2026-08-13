-- CreateTable
CREATE TABLE "public"."UserActivity" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "route" TEXT,
    "visitorId" TEXT,
    "sessionId" TEXT,
    "userId" TEXT,
    "contentType" TEXT,
    "contentId" TEXT,
    "contentName" TEXT,
    "metadata" JSONB,
    "deviceCategory" TEXT,
    "browserCategory" TEXT,

    CONSTRAINT "UserActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserActivity_createdAt_idx" ON "public"."UserActivity"("createdAt");

-- CreateIndex
CREATE INDEX "UserActivity_action_createdAt_idx" ON "public"."UserActivity"("action", "createdAt");

-- CreateIndex
CREATE INDEX "UserActivity_userId_createdAt_idx" ON "public"."UserActivity"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserActivity_visitorId_idx" ON "public"."UserActivity"("visitorId");

-- CreateIndex
CREATE INDEX "UserActivity_contentType_contentId_idx" ON "public"."UserActivity"("contentType", "contentId");

-- AddForeignKey
ALTER TABLE "public"."UserActivity" ADD CONSTRAINT "UserActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
