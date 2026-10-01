/**
 * Client HTTP typé pour l'API `/api/v1`.
 *
 * - Web : `createApiClient({ baseUrl: "" })` → cookies HttpOnly envoyés automatiquement.
 * - Mobile : `createApiClient({ baseUrl, getToken })` → en-tête `Authorization: Bearer`.
 */
import type {
  ApiErrorBody,
  AttendanceRevokeResponse,
  AttendanceValidateResponse,
  AuditLogDTO,
  AuthSessionDTO,
  DashboardStats,
  EnrollmentDTO,
  ErrorCode,
  HealthResponse,
  IssuedQrDTO,
  ListResponse,
  LoginResponse,
  ManualEnrollmentStatus,
  ParticipantDTO,
  ParticipantDetailDTO,
  ParticipantImportResult,
  ReportDTO,
  ReportType,
  Role,
  ScanResolveResponse,
  SessionDTO,
  SessionStatus,
  TrainingDTO,
  UserDTO,
  UserRef,
} from "@tm/shared-types";
import { ERROR_MESSAGES } from "@tm/shared-types";

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export interface ApiClientOptions {
  /** Origine de l'API, sans `/api/v1` (`""` pour la même origine). */
  baseUrl: string;
  getToken?: () => string | null | undefined | Promise<string | null | undefined>;
  fetch?: typeof fetch;
  /** Appelé sur toute réponse 401 (session expirée…). */
  onUnauthorized?: () => void;
}

type Query = Record<string, string | number | boolean | undefined | null>;

function toQuery(query?: Query): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export interface TrainingInput {
  reference: string;
  title: string;
  description?: string | null;
  defaultDurationMinutes?: number | null;
  active?: boolean;
}

export interface ParticipantInput {
  employeeRef?: string | null;
  firstName: string;
  lastName: string;
  department?: string | null;
  email?: string | null;
  active?: boolean;
}

export interface SessionInput {
  trainingId: string;
  trainerId?: string;
  startsAt: string;
  endsAt: string;
  location?: string | null;
  status?: "draft" | "planned" | "in_progress";
  notes?: string | null;
}

export type ReportRequest =
  | { type: "weekly" | "monthly" | "yearly" | "custom"; from: string; to: string }
  | { type: "session"; sessionId: string }
  | { type: "participant"; participantId: string; from?: string; to?: string };

export function createApiClient(options: ApiClientOptions) {
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
  const root = `${options.baseUrl.replace(/\/$/, "")}/api/v1`;

  async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
    const headers: Record<string, string> = { accept: "application/json" };
    const token = await options.getToken?.();
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers["content-type"] = "application/json";

    let response: Response;
    try {
      response = await doFetch(`${root}${path}${toQuery(query)}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: token ? "omit" : "same-origin",
      });
    } catch (cause) {
      throw new ApiClientError(0, "INTERNAL_ERROR", "Serveur injoignable. Vérifiez la connexion réseau.", cause);
    }

    if (response.status === 204) return undefined as T;
    const isJson = response.headers.get("content-type")?.includes("application/json");
    const data = isJson ? await response.json().catch(() => null) : null;

    if (!response.ok) {
      if (response.status === 401) options.onUnauthorized?.();
      const err = (data as ApiErrorBody | null)?.error;
      const code = err?.code ?? (response.status === 401 ? "UNAUTHORIZED" : "INTERNAL_ERROR");
      throw new ApiClientError(response.status, code, err?.message ?? ERROR_MESSAGES[code], err?.details);
    }
    return data as T;
  }

  const get = <T>(path: string, query?: Query) => request<T>("GET", path, undefined, query);
  const post = <T>(path: string, body: unknown = {}) => request<T>("POST", path, body);
  const patch = <T>(path: string, body: unknown) => request<T>("PATCH", path, body);
  const del = <T>(path: string) => request<T>("DELETE", path);
  const enc = encodeURIComponent;

  return {
    request,
    auth: {
      login: (body: { email: string; password: string; client?: "web" | "mobile"; deviceName?: string }) =>
        post<LoginResponse>("/auth/login", body),
      logout: () => post<{ ok: true }>("/auth/logout"),
      session: () => get<AuthSessionDTO>("/auth/session"),
      changePassword: (body: { currentPassword: string; newPassword: string }) =>
        post<{ ok: true }>("/auth/password", body),
    },
    users: {
      list: (query?: { role?: Role; includeDisabled?: boolean }) => get<ListResponse<UserDTO>>("/users", query),
      create: (body: { email: string; displayName: string; role: Role; password: string }) => post<UserDTO>("/users", body),
      update: (id: string, body: Partial<{ displayName: string; role: Role; disabled: boolean; password: string }>) =>
        patch<UserDTO>(`/users/${enc(id)}`, body),
      /** Formateurs et administrateurs actifs (accessible à tous les rôles). */
      trainers: () => get<ListResponse<UserRef & { role: Role }>>("/users/trainers"),
    },
    trainings: {
      list: (query?: { includeInactive?: boolean }) => get<ListResponse<TrainingDTO>>("/trainings", query),
      get: (id: string) => get<TrainingDTO>(`/trainings/${enc(id)}`),
      create: (body: TrainingInput) => post<TrainingDTO>("/trainings", body),
      update: (id: string, body: Partial<TrainingInput>) => patch<TrainingDTO>(`/trainings/${enc(id)}`, body),
      deactivate: (id: string) => del<TrainingDTO>(`/trainings/${enc(id)}`),
    },
    participants: {
      list: (query?: { q?: string; includeInactive?: boolean; limit?: number }) =>
        get<ListResponse<ParticipantDTO>>("/participants", query),
      get: (id: string) => get<ParticipantDetailDTO>(`/participants/${enc(id)}`),
      create: (body: ParticipantInput) => post<ParticipantDTO>("/participants", body),
      update: (id: string, body: Partial<ParticipantInput>) => patch<ParticipantDTO>(`/participants/${enc(id)}`, body),
      import: (csv: string) => post<ParticipantImportResult>("/participants/import", { csv }),
    },
    sessions: {
      list: (query?: { from?: string; to?: string; trainerId?: string; trainingId?: string; mine?: boolean; status?: SessionStatus }) =>
        get<ListResponse<SessionDTO>>("/sessions", query),
      get: (id: string) => get<SessionDTO>(`/sessions/${enc(id)}`),
      create: (body: SessionInput) => post<SessionDTO>("/sessions", body),
      update: (id: string, body: Partial<SessionInput>) => patch<SessionDTO>(`/sessions/${enc(id)}`, body),
      complete: (id: string) => post<SessionDTO>(`/sessions/${enc(id)}/complete`),
      cancel: (id: string, reason?: string) => post<SessionDTO>(`/sessions/${enc(id)}/cancel`, { reason }),
      enrollments: (id: string) => get<ListResponse<EnrollmentDTO>>(`/sessions/${enc(id)}/enrollments`),
      enroll: (id: string, participantIds: string[]) =>
        post<ListResponse<EnrollmentDTO>>(`/sessions/${enc(id)}/enrollments`, { participantIds }),
      unenroll: (id: string, enrollmentId: string) =>
        del<{ ok: true }>(`/sessions/${enc(id)}/enrollments/${enc(enrollmentId)}`),
      setEnrollmentStatus: (id: string, enrollmentId: string, status: ManualEnrollmentStatus) =>
        patch<EnrollmentDTO>(`/sessions/${enc(id)}/enrollments/${enc(enrollmentId)}`, { status }),
      issueQrBatch: (id: string, mode: "missing" | "all") => post<ListResponse<IssuedQrDTO>>(`/sessions/${enc(id)}/qr`, { mode }),
      exportCsvUrl: (id: string) => `${root}/sessions/${enc(id)}/export`,
    },
    qr: {
      issue: (enrollmentId: string) => post<IssuedQrDTO>(`/enrollments/${enc(enrollmentId)}/qr`),
      rotate: (enrollmentId: string) => post<IssuedQrDTO>(`/enrollments/${enc(enrollmentId)}/qr/rotate`),
    },
    scans: {
      resolve: (body: { payload: string; sessionId?: string; deviceId?: string }) =>
        post<ScanResolveResponse>("/scans/resolve", body),
    },
    attendance: {
      validate: (enrollmentId: string, body: { idempotencyKey: string; method?: "qr" | "manual"; deviceId?: string; note?: string }) =>
        post<AttendanceValidateResponse>(`/attendance/${enc(enrollmentId)}/validate`, body),
      revoke: (enrollmentId: string, reason?: string) =>
        post<AttendanceRevokeResponse>(`/attendance/${enc(enrollmentId)}/revoke`, { reason }),
    },
    stats: {
      dashboard: (query: { from: string; to: string; trainingId?: string; trainerId?: string; department?: string }) =>
        get<DashboardStats>("/stats/dashboard", query),
    },
    reports: {
      list: () => get<ListResponse<ReportDTO>>("/reports"),
      get: (id: string) => get<ReportDTO>(`/reports/${enc(id)}`),
      create: (body: ReportRequest) => post<ReportDTO>("/reports", body),
      downloadUrl: (id: string) => `${root}/reports/${enc(id)}/download`,
    },
    audit: {
      list: (query?: { limit?: number; before?: string; entityType?: string; entityId?: string; action?: string }) =>
        get<ListResponse<AuditLogDTO>>("/audit", query),
    },
    health: () => doFetch(`${options.baseUrl.replace(/\/$/, "")}/api/health`).then((r) => r.json() as Promise<HealthResponse>),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
export type { ReportType };
