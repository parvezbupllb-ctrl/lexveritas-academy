CREATE TABLE `package_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`code_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `exam_packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`code_id`) REFERENCES `codes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `package_session_token` ON `package_sessions` (`package_id`,`token_hash`);--> statement-breakpoint
ALTER TABLE `course_orders` ADD `first_access_ip` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `deleted_at` integer;