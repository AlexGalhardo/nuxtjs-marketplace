CREATE INDEX `addresses_user_idx` ON `addresses` (`user_id`);--> statement-breakpoint
CREATE INDEX `api_tokens_user_idx` ON `api_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `download_grants_order_item_idx` ON `download_grants` (`order_item_id`);--> statement-breakpoint
CREATE INDEX `order_items_seller_order_idx` ON `order_items` (`seller_order_id`);--> statement-breakpoint
CREATE INDEX `orders_buyer_created_idx` ON `orders` (`buyer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_checkout_session_idx` ON `orders` (`stripe_checkout_session_id`);--> statement-breakpoint
CREATE INDEX `product_files_product_idx` ON `product_files` (`product_id`);--> statement-breakpoint
CREATE INDEX `product_images_product_idx` ON `product_images` (`product_id`);--> statement-breakpoint
CREATE INDEX `products_shop_idx` ON `products` (`shop_id`);--> statement-breakpoint
CREATE INDEX `products_type_idx` ON `products` (`product_type_id`);--> statement-breakpoint
CREATE INDEX `products_status_created_idx` ON `products` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `seller_orders_order_idx` ON `seller_orders` (`order_id`);--> statement-breakpoint
CREATE INDEX `seller_orders_shop_created_idx` ON `seller_orders` (`shop_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `transaction_logs_order_idx` ON `transaction_logs` (`order_id`);--> statement-breakpoint
CREATE INDEX `transaction_logs_created_idx` ON `transaction_logs` (`created_at`);