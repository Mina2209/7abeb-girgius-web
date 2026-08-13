-- CreateTable
CREATE TABLE "public"."AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "route" TEXT,
    "visitorId" TEXT,
    "sessionId" TEXT,
    "contentType" TEXT,
    "contentId" TEXT,
    "contentName" TEXT,
    "deviceCategory" TEXT,
    "browserCategory" TEXT,
    "language" TEXT,
    "referrer" TEXT,
    "properties" JSONB,
    "userId" TEXT,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "public"."AnalyticsEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_eventName_createdAt_idx" ON "public"."AnalyticsEvent"("eventName", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_visitorId_idx" ON "public"."AnalyticsEvent"("visitorId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_sessionId_createdAt_idx" ON "public"."AnalyticsEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_route_createdAt_idx" ON "public"."AnalyticsEvent"("route", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_contentType_contentId_idx" ON "public"."AnalyticsEvent"("contentType", "contentId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_userId_idx" ON "public"."AnalyticsEvent"("userId");
