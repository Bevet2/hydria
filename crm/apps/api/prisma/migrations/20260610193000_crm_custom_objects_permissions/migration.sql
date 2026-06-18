ALTER TABLE "User" ADD COLUMN "teamId" TEXT;
ALTER TABLE "User" ADD COLUMN "permissionPolicy" JSONB;

CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissionPolicy" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomObjectDefinition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pluralName" TEXT NOT NULL,
    "description" TEXT,
    "fields" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomObjectDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomObjectRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "ownerId" TEXT,
    "displayName" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomObjectRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Team_organizationId_name_key" ON "Team"("organizationId", "name");
CREATE INDEX "User_organizationId_teamId_idx" ON "User"("organizationId", "teamId");
CREATE UNIQUE INDEX "CustomObjectDefinition_organizationId_key_key" ON "CustomObjectDefinition"("organizationId", "key");
CREATE INDEX "CustomObjectRecord_organizationId_definitionId_updatedAt_idx" ON "CustomObjectRecord"("organizationId", "definitionId", "updatedAt");

ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Team" ADD CONSTRAINT "Team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomObjectDefinition" ADD CONSTRAINT "CustomObjectDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomObjectRecord" ADD CONSTRAINT "CustomObjectRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomObjectRecord" ADD CONSTRAINT "CustomObjectRecord_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "CustomObjectDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
