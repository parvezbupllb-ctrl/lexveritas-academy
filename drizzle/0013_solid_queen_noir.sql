CREATE TABLE `coupon_redemptions` (
	`id` text PRIMARY KEY NOT NULL,
	`coupon_id` text NOT NULL,
	`user_key` text NOT NULL,
	`order_id` text NOT NULL,
	`discount_amount` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_coupon_redemption_order` ON `coupon_redemptions` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_coupon_redemption_user` ON `coupon_redemptions` (`coupon_id`,`user_key`);--> statement-breakpoint
PRAGMA optimize;
