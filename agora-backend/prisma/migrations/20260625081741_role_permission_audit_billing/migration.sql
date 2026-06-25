/*
  Warnings:

  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost (after being backfilled into role_id).
  - You are about to drop the `RefreshToken` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- DropForeignKey
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_userId_fkey";

-- DropTable
DROP TABLE "RefreshToken";

-- AlterTable
ALTER TABLE "StockLevel" ADD COLUMN     "high_stock_threshold" INTEGER NOT NULL DEFAULT 100;

-- Rename the old enum type out of the way so we can create a table also named "Role".
-- The User.role column still uses this enum, which is fine until we drop that column below.
ALTER TYPE "Role" RENAME TO "Role_old_enum";

-- CreateTable (moved up: Role must exist before User can reference it)
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "role_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "permission_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "performed_by" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingReport" (
    "id" TEXT NOT NULL,
    "report_date" DATE NOT NULL,
    "total_sales" DECIMAL(10,2) NOT NULL,
    "total_discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_transactions" INTEGER NOT NULL DEFAULT 0,
    "generated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_role_name_key" ON "Role"("role_name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_permission_name_key" ON "Permission"("permission_name");

-- CreateIndex
CREATE INDEX "RolePermission_role_id_idx" ON "RolePermission"("role_id");

-- CreateIndex
CREATE INDEX "RolePermission_permission_id_idx" ON "RolePermission"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_role_id_permission_id_key" ON "RolePermission"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "AuditLog_entity_type_entity_id_idx" ON "AuditLog"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "AuditLog_performed_by_idx" ON "AuditLog"("performed_by");

-- CreateIndex
CREATE INDEX "AuditLog_created_at_idx" ON "AuditLog"("created_at");

-- CreateIndex
CREATE INDEX "BillingReport_report_date_idx" ON "BillingReport"("report_date");

-- CreateIndex
CREATE UNIQUE INDEX "BillingReport_report_date_key" ON "BillingReport"("report_date");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the 4 roles that existed as enum values, so existing users can be backfilled.
-- gen_random_uuid() requires the pgcrypto extension; Supabase has it enabled by default.
INSERT INTO "Role" ("id", "role_name", "created_at", "updated_at")
VALUES
  (gen_random_uuid()::text, 'SUPER_ADMIN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'ADMIN',       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'MANAGER',     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CASHIER',     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterTable: add role_id as NULLABLE first so we can backfill before enforcing NOT NULL
ALTER TABLE "User" ADD COLUMN "role_id" TEXT;

-- Backfill role_id from the old role enum column (now named Role_old_enum)
UPDATE "User" u
SET "role_id" = r.id
FROM "Role" r
WHERE r.role_name = u.role::text;

-- Safety net: if any row didn't match (unexpected enum value, etc.), default to CASHIER
-- rather than letting the NOT NULL constraint below fail the whole migration.
UPDATE "User"
SET "role_id" = (SELECT id FROM "Role" WHERE role_name = 'CASHIER')
WHERE "role_id" IS NULL;

-- Now that every row has a role_id, enforce NOT NULL
ALTER TABLE "User" ALTER COLUMN "role_id" SET NOT NULL;

-- Safe to drop the old enum column now that data is migrated
ALTER TABLE "User" DROP COLUMN "role";

-- DropEnum (no longer referenced by any column)
DROP TYPE "Role_old_enum";

-- CreateIndex
CREATE INDEX "User_role_id_idx" ON "User"("role_id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;