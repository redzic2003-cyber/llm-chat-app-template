PRAGMA foreign_keys = ON;

CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin','trainer','viewer')),
    auth_subject TEXT UNIQUE,
    created_at TEXT NOT NULL,
    disabled_at TEXT
);

CREATE TABLE participants (
    id TEXT PRIMARY KEY,
    employee_ref TEXT UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    department TEXT,
    email TEXT,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE trainings (
    id TEXT PRIMARY KEY,
    reference TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    default_duration_minutes INTEGER,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE training_sessions (
    id TEXT PRIMARY KEY,
    training_id TEXT NOT NULL REFERENCES trainings(id),
    trainer_id TEXT NOT NULL REFERENCES users(id),
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','planned','in_progress','completed','cancelled')),
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (ends_at > starts_at)
);

CREATE TABLE enrollments (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    participant_id TEXT NOT NULL REFERENCES participants(id),
    status TEXT NOT NULL DEFAULT 'expected'
        CHECK (status IN ('invited','expected','present','absent','excused')),
    created_at TEXT NOT NULL,
    UNIQUE (session_id, participant_id)
);

CREATE TABLE qr_tokens (
    id TEXT PRIMARY KEY,
    enrollment_id TEXT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    expires_at TEXT,
    revoked_at TEXT,
    last_scanned_at TEXT,
    scan_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE attendance_validations (
    id TEXT PRIMARY KEY,
    enrollment_id TEXT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    validated_by TEXT NOT NULL REFERENCES users(id),
    validated_at TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'qr'
        CHECK (method IN ('qr','manual','offline_sync')),
    device_id TEXT,
    note TEXT
);

CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    actor_user_id TEXT REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    timestamp TEXT NOT NULL,
    metadata_json TEXT
);

CREATE TABLE reports (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    file_path TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    generated_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
);

CREATE INDEX idx_sessions_starts_at
    ON training_sessions(starts_at);

CREATE INDEX idx_sessions_training
    ON training_sessions(training_id);

CREATE INDEX idx_enrollments_session
    ON enrollments(session_id);

CREATE INDEX idx_enrollments_participant
    ON enrollments(participant_id);

CREATE INDEX idx_qr_enrollment
    ON qr_tokens(enrollment_id);

CREATE INDEX idx_attendance_enrollment
    ON attendance_validations(enrollment_id);

CREATE INDEX idx_attendance_validated_at
    ON attendance_validations(validated_at);

CREATE INDEX idx_audit_timestamp
    ON audit_logs(timestamp);
