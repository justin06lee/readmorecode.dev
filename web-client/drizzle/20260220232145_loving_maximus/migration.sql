CREATE TABLE `puzzles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`puzzle_id` text NOT NULL,
	`repo` text NOT NULL,
	`file` text NOT NULL,
	`commit` text NOT NULL,
	`question` text NOT NULL,
	`answer_key` text NOT NULL,
	`explanation` text NOT NULL,
	`grading_rubric` text NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `puzzles_puzzle_id_unique` ON `puzzles` (`puzzle_id`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`puzzle_id` text NOT NULL,
	`reason` text NOT NULL,
	`optional_detail` text,
	`client_reported_at` text,
	`reported_at` integer
);
