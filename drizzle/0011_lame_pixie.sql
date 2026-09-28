ALTER TABLE `answers` ADD `flagged` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `author` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `exam_category` text DEFAULT 'Academic' NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `subject` text DEFAULT 'General' NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `old_price` integer;--> statement-breakpoint
ALTER TABLE `exam_packages` ADD `old_price` integer;--> statement-breakpoint
ALTER TABLE `exam_packages` ADD `detailed_explanations` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `exam_packages` ADD `leaderboard` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `exams` ADD `syllabus` text DEFAULT '' NOT NULL;