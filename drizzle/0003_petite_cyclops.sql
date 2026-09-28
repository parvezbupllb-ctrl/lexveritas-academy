CREATE TABLE `blogs` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`thumbnail` text,
	`excerpt` text DEFAULT '' NOT NULL,
	`author_name` text NOT NULL,
	`author_photo` text,
	`author_description` text DEFAULT '' NOT NULL,
	`content` text NOT NULL,
	`publish_date` integer NOT NULL,
	`published` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blogs_slug_unique` ON `blogs` (`slug`);--> statement-breakpoint
CREATE INDEX `blog_published_date` ON `blogs` (`published`,`publish_date`);--> statement-breakpoint
CREATE TABLE `package_routines` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`exam_id` text NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `exam_packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `package_routine_package_order` ON `package_routines` (`package_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `package_routine_exam_window` ON `package_routines` (`exam_id`,`start`,`end`);--> statement-breakpoint
ALTER TABLE `exam_packages` ADD `thumbnail` text;--> statement-breakpoint
ALTER TABLE `exam_packages` ADD `details` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `exam_packages` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `exam_packages` ADD `max_participants` integer;--> statement-breakpoint
ALTER TABLE `exam_packages` ADD `access_days` integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE `exams` ADD `pass_mark` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `exams` ADD `question_target` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `exams` ADD `direct_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `exam_direct_token` ON `exams` (`direct_token`);--> statement-breakpoint
ALTER TABLE `package_orders` ADD `activated_at` integer;--> statement-breakpoint
ALTER TABLE `package_orders` ADD `expires_at` integer;