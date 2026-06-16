CREATE TABLE "AlertProofPacket" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "sourceAuthority" TEXT NOT NULL,
    "sourceReviewState" TEXT NOT NULL,
    "reviewerState" TEXT NOT NULL,
    "recipientState" TEXT NOT NULL,
    "httpsSourceCheck" BOOLEAN NOT NULL,
    "payloadDigest" TEXT NOT NULL,
    "gateStatus" TEXT NOT NULL,
    "reasons" TEXT[],
    "packetJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertProofPacket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AlertProofPacket_alertId_createdAt_idx" ON "AlertProofPacket"("alertId", "createdAt");
CREATE INDEX "AlertProofPacket_gateStatus_createdAt_idx" ON "AlertProofPacket"("gateStatus", "createdAt");
CREATE INDEX "AlertProofPacket_sourceReviewState_idx" ON "AlertProofPacket"("sourceReviewState");

ALTER TABLE "AlertProofPacket"
ADD CONSTRAINT "AlertProofPacket_alertId_fkey"
FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
