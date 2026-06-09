-- CreateTable
CREATE TABLE "OAuthAttempt" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "stateHash" TEXT NOT NULL,
    "encryptedCodeVerifier" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAttempt_stateHash_key" ON "OAuthAttempt"("stateHash");

-- CreateIndex
CREATE INDEX "OAuthAttempt_userId_provider_expiresAt_idx" ON "OAuthAttempt"("userId", "provider", "expiresAt");

-- CreateIndex
CREATE INDEX "OAuthAttempt_organizationId_expiresAt_idx" ON "OAuthAttempt"("organizationId", "expiresAt");

-- AddForeignKey
ALTER TABLE "OAuthAttempt" ADD CONSTRAINT "OAuthAttempt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAttempt" ADD CONSTRAINT "OAuthAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
