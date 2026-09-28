CREATE TABLE `code_exam_access` (
	`id` text PRIMARY KEY NOT NULL,
	`code_id` text NOT NULL,
	`exam_id` text NOT NULL,
	`package_order_id` text NOT NULL,
	FOREIGN KEY (`code_id`) REFERENCES `codes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`package_order_id`) REFERENCES `package_orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_code_exam_entitlement` ON `code_exam_access` (`code_id`,`exam_id`);--> statement-breakpoint
CREATE INDEX `code_exam_access_code` ON `code_exam_access` (`code_id`);--> statement-breakpoint
CREATE TABLE `exam_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`price` integer NOT NULL,
	`available` integer DEFAULT 1 NOT NULL,
	`published` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `package_exams` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`exam_id` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `exam_packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_exam_per_package` ON `package_exams` (`package_id`,`exam_id`);--> statement-breakpoint
CREATE INDEX `package_exam_order` ON `package_exams` (`package_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `package_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`package_id` text NOT NULL,
	`package_title` text NOT NULL,
	`price` integer NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`trx` text NOT NULL,
	`verified` integer DEFAULT 0 NOT NULL,
	`verified_at` integer,
	`verified_by` text,
	`access_code_id` text,
	FOREIGN KEY (`package_id`) REFERENCES `exam_packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`access_code_id`) REFERENCES `codes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `package_order_trx` ON `package_orders` (`trx`);--> statement-breakpoint
CREATE INDEX `package_order_phone` ON `package_orders` (`phone`);--> statement-breakpoint
CREATE INDEX `package_order_created` ON `package_orders` (`created_at`);