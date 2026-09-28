CREATE TABLE `admins` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`must_change` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admins_username_unique` ON `admins` (`username`);--> statement-breakpoint
CREATE TABLE `answers` (
	`id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`question_id` text NOT NULL,
	`selected` integer,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_answer` ON `answers` (`attempt_id`,`question_id`);--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_id` text NOT NULL,
	`code_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`student_name` text NOT NULL,
	`university` text NOT NULL,
	`started_at` integer NOT NULL,
	`deadline` integer NOT NULL,
	`submitted_at` integer,
	`duration` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`correct` integer DEFAULT 0 NOT NULL,
	`wrong` integer DEFAULT 0 NOT NULL,
	`unanswered` integer DEFAULT 0 NOT NULL,
	`positive` integer DEFAULT 0 NOT NULL,
	`negative` integer DEFAULT 0 NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`percentage` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`code_id`) REFERENCES `codes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_code_one_exam` ON `attempts` (`exam_id`,`code_id`);--> statement-breakpoint
CREATE INDEX `attempt_ranking` ON `attempts` (`exam_id`,`status`,`score`,`wrong`,`duration`,`submitted_at`);--> statement-breakpoint
CREATE INDEX `attempt_deadline` ON `attempts` (`status`,`deadline`);--> statement-breakpoint
CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_id` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`price` integer NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`cover` text,
	`preview` text,
	`digital` text,
	`available` integer DEFAULT 1 NOT NULL,
	`published` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `codes_code_unique` ON `codes` (`code`);--> statement-breakpoint
CREATE TABLE `exams` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	`duration` integer NOT NULL,
	`correct_mark` integer DEFAULT 100 NOT NULL,
	`negative_mark` integer DEFAULT 25 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`result_mode` text DEFAULT 'auto' NOT NULL,
	`results_published` integer DEFAULT 0 NOT NULL,
	`published_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `exam_status_time` ON `exams` (`status`,`end`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`visibility` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hard_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`book_id` text NOT NULL,
	`title` text NOT NULL,
	`quantity` integer NOT NULL,
	`price` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `hard_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `items_order` ON `hard_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `hard_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`phone` text NOT NULL,
	`trx` text NOT NULL,
	`subtotal` integer NOT NULL,
	`delivery` text NOT NULL,
	`delivery_charge` integer NOT NULL,
	`payment_type` text NOT NULL,
	`paid` integer NOT NULL,
	`due` integer NOT NULL,
	`total` integer NOT NULL,
	`verified` integer DEFAULT 0 NOT NULL,
	`verified_at` integer,
	`verified_by` text,
	`delivered` integer DEFAULT 0 NOT NULL,
	`delivered_at` integer,
	`received` integer DEFAULT 0 NOT NULL,
	`received_at` integer
);
--> statement-breakpoint
CREATE INDEX `hard_trx` ON `hard_orders` (`trx`);--> statement-breakpoint
CREATE INDEX `hard_phone` ON `hard_orders` (`phone`);--> statement-breakpoint
CREATE INDEX `hard_created` ON `hard_orders` (`created_at`);--> statement-breakpoint
CREATE TABLE `limits` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_id` text NOT NULL,
	`question` text NOT NULL,
	`options` text NOT NULL,
	`correct_option` integer NOT NULL,
	`explanation` text DEFAULT '' NOT NULL,
	`image` text,
	`display_order` integer NOT NULL,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `question_exam_order` ON `questions` (`exam_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_id` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `soft_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`book_id` text NOT NULL,
	`book_title` text NOT NULL,
	`price` integer NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`trx` text NOT NULL,
	`verified` integer DEFAULT 0 NOT NULL,
	`verified_at` integer,
	`verified_by` text,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `soft_trx` ON `soft_orders` (`trx`);--> statement-breakpoint
CREATE INDEX `soft_phone` ON `soft_orders` (`phone`);--> statement-breakpoint
CREATE INDEX `soft_created` ON `soft_orders` (`created_at`);