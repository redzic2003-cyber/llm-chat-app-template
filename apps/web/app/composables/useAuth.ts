import type { Role, UserDTO } from "@tm/shared-types";

type Permission =
  | "trainings:write"
  | "participants:write"
  | "sessions:create"
  | "sessions:manage-any"
  | "reports:generate"
  | "users:manage"
  | "audit:read";

/** Miroir de la matrice serveur, uniquement pour adapter l'interface (le serveur reste l'autorité). */
const MATRIX: Record<Role, Permission[]> = {
  admin: ["trainings:write", "participants:write", "sessions:create", "sessions:manage-any", "reports:generate", "users:manage", "audit:read"],
  trainer: ["sessions:create", "reports:generate"],
  viewer: [],
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrateur",
  trainer: "Formateur",
  viewer: "Lecture seule",
};

export function useAuth() {
  const user = useState<UserDTO | null>("auth-user", () => null);
  const api = useApi();

  async function refresh(): Promise<UserDTO | null> {
    try {
      user.value = (await api.auth.session()).user;
    } catch {
      user.value = null;
    }
    return user.value;
  }

  async function login(email: string, password: string) {
    const result = await api.auth.login({ email, password, client: "web" });
    user.value = result.user;
    return result.user;
  }

  async function logout() {
    try {
      await api.auth.logout();
    } finally {
      user.value = null;
      await navigateTo("/login");
    }
  }

  const can = (permission: Permission) => (user.value ? MATRIX[user.value.role].includes(permission) : false);
  const canManageSession = (session: { trainer: { id: string } }) =>
    can("sessions:manage-any") || (user.value?.role === "trainer" && session.trainer.id === user.value.id);

  return { user, refresh, login, logout, can, canManageSession };
}
