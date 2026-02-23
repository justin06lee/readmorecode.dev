PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_puzzles` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`puzzle_id` text NOT NULL UNIQUE,
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
INSERT INTO `__new_puzzles`(`id`, `puzzle_id`, `repo`, `file`, `commit`, `question`, `answer_key`, `explanation`, `grading_rubric`, `created_at`) SELECT `id`, `puzzle_id`, `repo`, `file`, `commit`, `question`, `answer_key`, `explanation`, `grading_rubric`, `created_at` FROM `puzzles`;--> statement-breakpoint
DROP TABLE `puzzles`;--> statement-breakpoint
ALTER TABLE `__new_puzzles` RENAME TO `puzzles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP INDEX IF EXISTS `puzzles_puzzle_id_unique`;