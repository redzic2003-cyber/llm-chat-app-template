CREATE TABLE `attendance_validations` (
	`id` text PRIMARY KEY NOT NULL,
	`enrollment_id` text NOT NULL,
	`validated_by` text NOT NULL,
	`validated_at` text NOT NULL,
	`method` text DEFAULT 'qr' NOT NULL,
	`device_id` text,
	`note` text,
	`idempotency_key` text,
	`revoked_at` text,
	`revoked_by` text,
	`revoke_reason` text,
	FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`validated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`revoked_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "attendance_method_check" CHECK("attendance_validations"."method" IN ('qr','manual','offline_sync'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_validations_idempotency_key_unique` ON `attendance_validations` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_attendance_enrollment` ON `attendance_validations` (`enrollment_id`);--> statement-breakpoint
CREATE INDEX `idx_attendance_validated_at` ON `attendance_validations` (`validated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_one_active_per_enrollment` ON `attendance_validations` (`enrollment_id`) WHERE revoked_at IS NULL;--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`timestamp` text NOT NULL,
	`metadata_json` text,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_timestamp` ON `audit_logs` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_audit_entity` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`device_name` text,
	`created_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "auth_sessions_kind_check" CHECK("auth_sessions"."kind" IN ('web','mobile'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_sessions_token_hash_unique` ON `auth_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_auth_sessions_user` ON `auth_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`status` text DEFAULT 'expected' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `training_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "enrollments_status_check" CHECK("enrollments"."status" IN ('invited','expected','present','absent','excused'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `enrollments_session_participant_unique` ON `enrollments` (`session_id`,`participant_id`);--> statement-breakpoint
CREATE INDEX `idx_enrollments_session` ON `enrollments` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_enrollments_participant` ON `enrollments` (`participant_id`);--> statement-breakpoint
CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_ref` text,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`department` text,
	`email` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "participants_active_check" CHECK("participants"."active" IN (0,1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participants_employee_ref_unique` ON `participants` (`employee_ref`);--> statement-breakpoint
CREATE INDEX `idx_participants_name` ON `participants` (`last_name`,`first_name`);--> statement-breakpoint
CREATE TABLE `qr_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`enrollment_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text,
	`revoked_at` text,
	`last_scanned_at` text,
	`scan_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `qr_tokens_token_hash_unique` ON `qr_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_qr_enrollment` ON `qr_tokens` (`enrollment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `qr_tokens_one_active_per_enrollment` ON `qr_tokens` (`enrollment_id`) WHERE revoked_at IS NULL;--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`file_path` text NOT NULL,
	`sha256` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`params_json` text,
	`generated_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`generated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_reports_created_at` ON `reports` (`created_at`);--> statement-breakpoint
CREATE TABLE `training_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`training_id` text NOT NULL,
	`trainer_id` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`location` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`training_id`) REFERENCES `trainings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "training_sessions_status_check" CHECK("training_sessions"."status" IN ('draft','planned','in_progress','completed','cancelled')),
	CONSTRAINT "training_sessions_time_check" CHECK("training_sessions"."ends_at" > "training_sessions"."starts_at")
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_starts_at` ON `training_sessions` (`starts_at`);--> statement-breakpoint
CREATE INDEX `idx_sessions_training` ON `training_sessions` (`training_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_trainer` ON `training_sessions` (`trainer_id`);--> statement-breakpoint
CREATE TABLE `trainings` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`default_duration_minutes` integer,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "trainings_active_check" CHECK("trainings"."active" IN (0,1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trainings_reference_unique` ON `trainings` (`reference`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`password_hash` text,
	`auth_subject` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`disabled_at` text,
	CONSTRAINT "users_role_check" CHECK("users"."role" IN ('admin','trainer','viewer'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_auth_subject_unique` ON `users` (`auth_subject`);