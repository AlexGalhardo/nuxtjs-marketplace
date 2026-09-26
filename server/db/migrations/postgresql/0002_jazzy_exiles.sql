DROP INDEX "products_shop_idx";--> statement-breakpoint
CREATE INDEX "products_shop_created_idx" ON "products" USING btree ("shop_id","created_at");