CREATE TABLE `code_entitlements` (
	`id` text PRIMARY KEY NOT NULL,
	`code_id` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`code_id`) REFERENCES `codes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entitlement_code_resource` ON `code_entitlements` (`code_id`,`resource_type`,`resource_id`);--> statement-breakpoint
CREATE INDEX `entitlement_resource` ON `code_entitlements` (`resource_type`,`resource_id`);--> statement-breakpoint
DROP INDEX `one_code_one_exam`;--> statement-breakpoint
CREATE INDEX `attempt_exam_code` ON `attempts` (`exam_id`,`code_id`);--> statement-breakpoint
ALTER TABLE `codes` ADD `device_hash` text;--> statement-breakpoint
ALTER TABLE `codes` ADD `claimed_at` integer;--> statement-breakpoint
ALTER TABLE `course_content` ADD `access_mode` text DEFAULT 'code' NOT NULL;--> statement-breakpoint
UPDATE `course_content` SET `access_mode`='public' WHERE `free_preview`=1;--> statement-breakpoint
ALTER TABLE `courses` ADD `access_mode` text DEFAULT 'code' NOT NULL;--> statement-breakpoint
ALTER TABLE `exam_packages` ADD `access_mode` text DEFAULT 'code' NOT NULL;--> statement-breakpoint
ALTER TABLE `exams` ADD `access_mode` text DEFAULT 'code' NOT NULL;--> statement-breakpoint
ALTER TABLE `exams` ADD `attempt_limit` integer DEFAULT 1 NOT NULL;
