CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`recipient` text NOT NULL,
	`sender` text NOT NULL,
	`project_id` text NOT NULL,
	`project_title` text NOT NULL,
	`task_id` text,
	`task_title` text,
	`deliverable` text NOT NULL,
	`reason` text NOT NULL,
	`turn_id` text NOT NULL,
	`active_key` text,
	`created_at` text NOT NULL,
	`read_at` text,
	`resolved_at` text,
	`resolution_note` text,
	`sender_read_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_active_key_unique` ON `notifications` (`active_key`);--> statement-breakpoint
CREATE INDEX `notification_recipient_date` ON `notifications` (`recipient`,`created_at`);--> statement-breakpoint
CREATE INDEX `notification_sender_date` ON `notifications` (`sender`,`created_at`);--> statement-breakpoint
ALTER TABLE `manager_turns` ADD `notification_drafts` text DEFAULT '[]' NOT NULL;