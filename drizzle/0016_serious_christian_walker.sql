CREATE TABLE `course_content` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`parent_id` text,
	`node_type` text NOT NULL,
	`lesson_type` text,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`video_url` text,
	`video_id` text,
	`video_duration` text DEFAULT '' NOT NULL,
	`thumbnail` text,
	`instructor` text DEFAULT '' NOT NULL,
	`file_id` text,
	`resources` text DEFAULT '[]' NOT NULL,
	`exam_id` text,
	`package_id` text,
	`external_url` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`free_preview` integer DEFAULT 0 NOT NULL,
	`download_allowed` integer DEFAULT 0 NOT NULL,
	`unlock_rule` text DEFAULT 'immediate' NOT NULL,
	`unlock_value` text DEFAULT '' NOT NULL,
	`attempts_allowed` integer DEFAULT 1 NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`package_id`) REFERENCES `exam_packages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_course_content_course_parent_order` ON `course_content` (`course_id`,`parent_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `idx_course_content_exam` ON `course_content` (`exam_id`);--> statement-breakpoint
CREATE TABLE `course_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`code_id` text NOT NULL,
	`content_id` text NOT NULL,
	`completed` integer DEFAULT 0 NOT NULL,
	`watched_seconds` integer DEFAULT 0 NOT NULL,
	`opened_at` integer NOT NULL,
	`completed_at` integer,
	`exam_score` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`code_id`) REFERENCES `codes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`content_id`) REFERENCES `course_content`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_course_progress_unique` ON `course_progress` (`course_id`,`code_id`,`content_id`);--> statement-breakpoint
CREATE INDEX `idx_course_progress_student` ON `course_progress` (`course_id`,`code_id`,`completed`);--> statement-breakpoint
CREATE TABLE `course_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`code_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires` integer NOT NULL,
	`last_accessed_content_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`code_id`) REFERENCES `codes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_course_session_course_code` ON `course_sessions` (`course_id`,`code_id`);--> statement-breakpoint
CREATE INDEX `idx_course_session_expiry` ON `course_sessions` (`expires`);--> statement-breakpoint
ALTER TABLE `courses` ADD `full_description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `category` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `subject` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `instructor` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `regular_price` integer;--> statement-breakpoint
ALTER TABLE `courses` ADD `pricing_type` text DEFAULT 'paid' NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `duration_label` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `access_validity_days` integer DEFAULT 365 NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `enrollment_start` integer;--> statement-breakpoint
ALTER TABLE `courses` ADD `course_start` integer;--> statement-breakpoint
ALTER TABLE `courses` ADD `course_end` integer;--> statement-breakpoint
ALTER TABLE `courses` ADD `maximum_students` integer;--> statement-breakpoint
ALTER TABLE `courses` ADD `enrollment_open` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `featured` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `status` text DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `sequential_learning` integer DEFAULT 0 NOT NULL;
