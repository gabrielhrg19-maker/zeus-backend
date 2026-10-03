-- AlterTable
ALTER TABLE "User" ADD COLUMN "acceptedTermsAt" TIMESTAMP(3),
ADD COLUMN "acceptedTermsVersion" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "acceptedTermsAt" TIMESTAMP(3),
ADD COLUMN "acceptedTermsVersion" TEXT;
