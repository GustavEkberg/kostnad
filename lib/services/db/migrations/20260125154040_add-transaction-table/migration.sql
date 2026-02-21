CREATE TABLE "transaction" (
	"id" text PRIMARY KEY,
	"date" timestamp NOT NULL,
	"merchant" text NOT NULL,
	"amount" numeric(12,2) NOT NULL,
	"balance" numeric(12,2),
	"categoryId" text,
	"uploadId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "transaction_date_idx" ON "transaction" ("date");--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_categoryId_category_id_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id");--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_uploadId_upload_id_fkey" FOREIGN KEY ("uploadId") REFERENCES "upload"("id") ON DELETE CASCADE;