ALTER TABLE "ProductMap"
ADD COLUMN "confirmationRequired" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "lastConfirmedAt" TIMESTAMP(3),
ADD COLUMN "nextConfirmationDueAt" TIMESTAMP(3),
ADD COLUMN "confirmedByName" TEXT;
