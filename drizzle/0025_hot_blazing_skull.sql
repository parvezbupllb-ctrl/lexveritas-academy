CREATE TABLE `package_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`code_id` text NOT NULL,
	`name` text NOT NULL,
	`university` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`photo` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `exam_packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`code_id`) REFERENCES `codes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `package_profile_unique` ON `package_profiles` (`package_id`,`code_id`);--> statement-breakpoint
ALTER TABLE `attempts` ADD `package_id` text;--> statement-breakpoint
CREATE INDEX `attempt_package_exam_code` ON `attempts` (`package_id`,`exam_id`,`code_id`);--> statement-breakpoint
ALTER TABLE `package_exams` ADD `support_pdf` text;