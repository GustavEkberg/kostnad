ALTER TABLE "transaction" ADD COLUMN "originalHash" text;--> statement-breakpoint
UPDATE "transaction" SET "originalHash" = encode(sha256((date::text || '|' || amount::text || '|' || merchant)::bytea), 'hex');--> statement-breakpoint
ALTER TABLE "transaction" ALTER COLUMN "originalHash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction" ALTER COLUMN "uploadId" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "transaction_hash_idx" ON "transaction" ("originalHash");