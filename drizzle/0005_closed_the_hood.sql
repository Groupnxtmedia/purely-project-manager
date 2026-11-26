CREATE TABLE `china_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`author` text NOT NULL,
	`kind` text DEFAULT 'team' NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`reply_to` text,
	`request_david` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `china_tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `china_messages_reply_to_unique` ON `china_messages` (`reply_to`);--> statement-breakpoint
CREATE INDEX `china_messages_task_date` ON `china_messages` (`task_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `china_tables` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `china_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`table_id` text NOT NULL,
	`title` text NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`priority` text DEFAULT 'Medium' NOT NULL,
	`status` text DEFAULT 'Not started' NOT NULL,
	`assignee` text,
	`notes` text DEFAULT '' NOT NULL,
	`deadline` text,
	`revision` integer DEFAULT 0 NOT NULL,
	`archived_at` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`table_id`) REFERENCES `china_tables`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `china_tasks_table_archive` ON `china_tasks` (`table_id`,`archived_at`);