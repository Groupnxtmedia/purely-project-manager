CREATE TABLE `assigned_briefs` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`size` integer NOT NULL,
	`content_type` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `assigned_brief_job` ON `assigned_briefs` (`owner_id`,`job_id`);--> statement-breakpoint
CREATE TABLE `assigned_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`assignee` text NOT NULL,
	`brief` text DEFAULT '' NOT NULL,
	`deadline` text NOT NULL,
	`completed_at` text,
	`revision` integer DEFAULT 0 NOT NULL,
	`reminder_version` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `assigned_owner_deadline` ON `assigned_jobs` (`owner_id`,`deadline`);--> statement-breakpoint
CREATE TABLE `assigned_owner` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `assigned_reminder_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`ran_at` text NOT NULL,
	`created_count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `assigned_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`job_id` text NOT NULL,
	`reminder_version` integer NOT NULL,
	`kind` text NOT NULL,
	`reminder_date` text NOT NULL,
	`created_at` text NOT NULL,
	`read_at` text
);
--> statement-breakpoint
CREATE INDEX `assigned_reminder_owner` ON `assigned_reminders` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `assigned_turns` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`message` text NOT NULL,
	`reply` text DEFAULT '' NOT NULL,
	`proposals` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`confirmation_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `assigned_turn_owner` ON `assigned_turns` (`owner_id`,`created_at`);