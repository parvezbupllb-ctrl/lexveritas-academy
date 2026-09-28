CREATE TABLE `backup_history` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`verified_at` integer
);
--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`discount_type` text NOT NULL,
	`discount_value` integer NOT NULL,
	`minimum_order` integer DEFAULT 0 NOT NULL,
	`maximum_discount` integer,
	`starts_at` integer,
	`expires_at` integer,
	`usage_limit` integer,
	`per_user_limit` integer DEFAULT 1 NOT NULL,
	`applies_to` text DEFAULT '["entire_store"]' NOT NULL,
	`product_ids` text DEFAULT '[]' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`times_used` integer DEFAULT 0 NOT NULL,
	`total_discount` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_coupons_code` ON `coupons` (`code`);--> statement-breakpoint
CREATE INDEX `idx_coupons_active_dates` ON `coupons` (`active`,`starts_at`,`expires_at`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`order_type` text NOT NULL,
	`customer` text NOT NULL,
	`amount` integer NOT NULL,
	`method` text NOT NULL,
	`transaction_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`refund_amount` integer DEFAULT 0 NOT NULL,
	`admin_note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_payments_order` ON `payments` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_payments_status_date` ON `payments` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_payments_transaction` ON `payments` (`transaction_id`);--> statement-breakpoint
ALTER TABLE `admins` ADD `active` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `admins` ADD `last_login_at` integer;--> statement-breakpoint
ALTER TABLE `audit` ADD `result` text DEFAULT 'success' NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `authors` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `subjects` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `book_types` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `course_orders` ADD `email` text;--> statement-breakpoint
ALTER TABLE `course_orders` ADD `payment_method` text DEFAULT 'bkash' NOT NULL;--> statement-breakpoint
ALTER TABLE `course_orders` ADD `coupon_code` text;--> statement-breakpoint
ALTER TABLE `course_orders` ADD `discount_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `course_orders` ADD `activated_at` integer;--> statement-breakpoint
ALTER TABLE `course_orders` ADD `expires_at` integer;--> statement-breakpoint
ALTER TABLE `course_orders` ADD `access_suspended` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `hard_orders` ADD `email` text;--> statement-breakpoint
ALTER TABLE `hard_orders` ADD `payment_method` text DEFAULT 'bkash' NOT NULL;--> statement-breakpoint
ALTER TABLE `hard_orders` ADD `coupon_code` text;--> statement-breakpoint
ALTER TABLE `hard_orders` ADD `discount_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `notes` ADD `subcategory` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `package_orders` ADD `email` text;--> statement-breakpoint
ALTER TABLE `package_orders` ADD `payment_method` text DEFAULT 'bkash' NOT NULL;--> statement-breakpoint
ALTER TABLE `package_orders` ADD `coupon_code` text;--> statement-breakpoint
ALTER TABLE `package_orders` ADD `discount_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `package_orders` ADD `access_suspended` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `soft_orders` ADD `email` text;--> statement-breakpoint
ALTER TABLE `soft_orders` ADD `payment_method` text DEFAULT 'bkash' NOT NULL;--> statement-breakpoint
ALTER TABLE `soft_orders` ADD `coupon_code` text;--> statement-breakpoint
ALTER TABLE `soft_orders` ADD `discount_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
PRAGMA optimize;
