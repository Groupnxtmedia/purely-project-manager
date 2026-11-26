CREATE TABLE `manager_turns` (
	`id` text PRIMARY KEY NOT NULL,
	`author` text NOT NULL,
	`message` text NOT NULL,
	`reply` text DEFAULT '' NOT NULL,
	`drafts` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`confirmation_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `manager_author_created` ON `manager_turns` (`author`,`created_at`);--> statement-breakpoint
CREATE TABLE `project_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`project_title` text NOT NULL,
	`author` text NOT NULL,
	`work_done` text NOT NULL,
	`status` text,
	`next_steps` text,
	`blockers` text,
	`created_at` text NOT NULL,
	`turn_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `project_log_date` ON `project_logs` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `project_memory` (
	`project_id` text PRIMARY KEY NOT NULL,
	`status` text,
	`next_steps` text,
	`blockers` text,
	`updated_at` text NOT NULL,
	`author` text NOT NULL,
	`last_log_id` text NOT NULL
);
