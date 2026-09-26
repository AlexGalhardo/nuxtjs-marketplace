CREATE INDEX "addresses_user_idx" ON "addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_tokens_user_idx" ON "api_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "download_grants_order_item_idx" ON "download_grants" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "order_items_seller_order_idx" ON "order_items" USING btree ("seller_order_id");--> statement-breakpoint
CREATE INDEX "orders_buyer_created_idx" ON "orders" USING btree ("buyer_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_checkout_session_idx" ON "orders" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE INDEX "product_files_product_idx" ON "product_files" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_shop_idx" ON "products" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "products_type_idx" ON "products" USING btree ("product_type_id");--> statement-breakpoint
CREATE INDEX "products_status_created_idx" ON "products" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "seller_orders_order_idx" ON "seller_orders" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "seller_orders_shop_created_idx" ON "seller_orders" USING btree ("shop_id","created_at");--> statement-breakpoint
CREATE INDEX "transaction_logs_order_idx" ON "transaction_logs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "transaction_logs_created_idx" ON "transaction_logs" USING btree ("created_at");