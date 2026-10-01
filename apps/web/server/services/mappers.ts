import type {
  Participant,
  Training,
  TrainingSession,
  User,
} from "@tm/database";
import type {
  EnrollmentCounts,
  ParticipantDTO,
  ParticipantRef,
  SessionDTO,
  TrainingDTO,
  TrainingRef,
  UserDTO,
  UserRef,
} from "@tm/shared-types";

export function toUserDTO(u: User): UserDTO {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    createdAt: u.createdAt,
    disabledAt: u.disabledAt,
  };
}

export const toUserRef = (u: Pick<User, "id" | "displayName">): UserRef => ({ id: u.id, displayName: u.displayName });

export function toTrainingDTO(t: Training): TrainingDTO {
  return {
    id: t.id,
    reference: t.reference,
    title: t.title,
    description: t.description,
    defaultDurationMinutes: t.defaultDurationMinutes,
    active: t.active,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

export const toTrainingRef = (t: Pick<Training, "id" | "reference" | "title">): TrainingRef => ({
  id: t.id,
  reference: t.reference,
  title: t.title,
});

export function toParticipantRef(p: Participant): ParticipantRef {
  return {
    id: p.id,
    employeeRef: p.employeeRef,
    firstName: p.firstName,
    lastName: p.lastName,
    department: p.department,
  };
}

export function toParticipantDTO(p: Participant): ParticipantDTO {
  return {
    ...toParticipantRef(p),
    email: p.email,
    active: p.active,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export const EMPTY_COUNTS: EnrollmentCounts = { enrolled: 0, present: 0, absent: 0, excused: 0, pending: 0 };

export function toSessionDTO(
  s: TrainingSession,
  training: Pick<Training, "id" | "reference" | "title">,
  trainer: Pick<User, "id" | "displayName">,
  counts: EnrollmentCounts = EMPTY_COUNTS,
): SessionDTO {
  return {
    id: s.id,
    training: toTrainingRef(training),
    trainer: toUserRef(trainer),
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    location: s.location,
    status: s.status,
    notes: s.notes,
    counts,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}
