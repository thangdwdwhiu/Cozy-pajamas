ALTER TABLE "products" ADD COLUMN "images" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
UPDATE "products" SET "images" = jsonb_build_array("image") WHERE "images" = '[]'::jsonb;
