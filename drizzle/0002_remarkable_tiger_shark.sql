CREATE TABLE `course_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`course_id` text NOT NULL,
	`course_name` text NOT NULL,
	`price` integer NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`trx` text NOT NULL,
	`verified` integer DEFAULT 0 NOT NULL,
	`verified_at` integer,
	`verified_by` text,
	`access_code_id` text,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`access_code_id`) REFERENCES `codes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `course_order_trx` ON `course_orders` (`trx`);--> statement-breakpoint
CREATE INDEX `course_order_phone` ON `course_orders` (`phone`);--> statement-breakpoint
CREATE INDEX `course_order_created` ON `course_orders` (`created_at`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`thumbnail` text,
	`description` text DEFAULT '' NOT NULL,
	`class_count` integer DEFAULT 0 NOT NULL,
	`exam_count` integer DEFAULT 0 NOT NULL,
	`sheet_count` integer DEFAULT 0 NOT NULL,
	`price` integer NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`package_id` text,
	`active` integer DEFAULT 1 NOT NULL,
	`published` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `exam_packages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `course_published_created` ON `courses` (`published`,`created_at`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`thumbnail` text,
	`file` text,
	`link` text,
	`published` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `note_category_published` ON `notes` (`category`,`published`,`created_at`);--> statement-breakpoint
CREATE TABLE `notices` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`notice_date` integer NOT NULL,
	`published` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notice_published_date` ON `notices` (`published`,`notice_date`);--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`photo` text,
	`active` integer DEFAULT 1 NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `team_active_order` ON `team_members` (`active`,`display_order`);