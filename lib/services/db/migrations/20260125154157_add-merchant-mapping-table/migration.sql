CREATE TABLE "merchant_mapping" (
	"id" text PRIMARY KEY,
	"merchantPattern" text NOT NULL UNIQUE,
	"categoryId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchant_mapping" ADD CONSTRAINT "merchant_mapping_categoryId_category_id_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id");