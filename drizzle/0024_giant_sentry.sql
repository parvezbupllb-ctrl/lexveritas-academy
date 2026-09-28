CREATE TABLE `study_config` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `study_curricula` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`marks` integer,
	`active` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `study_curricula_code_unique` ON `study_curricula` (`code`);--> statement-breakpoint
CREATE TABLE `study_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`curriculum_id` text NOT NULL,
	`parent_id` text,
	`type` text NOT NULL,
	`title_bn` text NOT NULL,
	`title_en` text DEFAULT '' NOT NULL,
	`reference_number` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`marks` integer,
	`workload_weight` integer DEFAULT 100 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`estimated_workload` integer DEFAULT 100 NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`curriculum_id`) REFERENCES `study_curricula`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_study_nodes_tree` ON `study_nodes` (`curriculum_id`,`parent_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `study_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`curriculum_id` text NOT NULL,
	`title` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`study_days` text NOT NULL,
	`off_dates` text DEFAULT '[]' NOT NULL,
	`daily_workload` integer DEFAULT 400 NOT NULL,
	`daily_limit` integer DEFAULT 6 NOT NULL,
	`carry_mode` text DEFAULT 'auto' NOT NULL,
	`mode` text DEFAULT 'smart' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`selections` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `study_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`curriculum_id`) REFERENCES `study_curricula`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_study_plans_user` ON `study_plans` (`user_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `study_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `study_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `study_sessions_token_hash_unique` ON `study_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_study_sessions_user` ON `study_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `study_task_history` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`action` text NOT NULL,
	`previous_date` text,
	`next_date` text,
	`details` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `study_tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `study_plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_study_task_history_plan` ON `study_task_history` (`plan_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `study_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`node_id` text,
	`title_snapshot` text NOT NULL,
	`subject_snapshot` text NOT NULL,
	`reference_snapshot` text DEFAULT '' NOT NULL,
	`original_date` text NOT NULL,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`carry_count` integer DEFAULT 0 NOT NULL,
	`completed_at` integer,
	`priority` integer DEFAULT 1 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`workload` integer DEFAULT 100 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `study_plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_study_tasks_plan_date` ON `study_tasks` (`plan_id`,`due_date`,`status`);--> statement-breakpoint
CREATE TABLE `study_users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`university` text NOT NULL,
	`phone` text NOT NULL,
	`password_hash` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`last_login_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `study_users_phone_unique` ON `study_users` (`phone`);