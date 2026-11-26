CREATE TABLE `gantt_boards` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`start_week` text NOT NULL,
	`end_week` text NOT NULL,
	`first_week_number` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gantt_boards_name_key_unique` ON `gantt_boards` (`name_key`);--> statement-breakpoint
ALTER TABLE `manager_turns` ADD `board_id` text DEFAULT 'team' NOT NULL;--> statement-breakpoint
ALTER TABLE `notifications` ADD `board_id` text DEFAULT 'team' NOT NULL;