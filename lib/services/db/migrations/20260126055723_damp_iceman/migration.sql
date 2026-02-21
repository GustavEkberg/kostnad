ALTER TABLE "merchant_mapping" ADD COLUMN "isMultiMerchant" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "merchant_mapping" ALTER COLUMN "categoryId" DROP NOT NULL;