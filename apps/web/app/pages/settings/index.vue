<script setup lang="ts">
import type { AuditLogDTO, HealthResponse, Role, UserDTO } from "@tm/shared-types";

const api = useApi();
const toast = useToast();
const fmt = useFormat();
const config = useRuntimeConfig();
const { user, can } = useAuth();
const { confirm } = useConfirm();

type Tab = "account" | "users" | "audit" | "system";
const tab = ref<Tab>("account");
const tabs = computed(() =>
  [
    { id: "account" as const, label: "Mon compte", show: true },
    { id: "users" as const, label: "Utilisateurs", show: can("users:manage") },
    { id: "audit" as const, label: "Journal d'audit", show: can("audit:read") },
    { id: "system" as const, label: "Système", show: true },
  ].filter((t) => t.show),
);

// --- Mon compte
const pwd = reactive({ current: "", next: "", confirm: "" });
const pwdError = ref("");
async function changePassword() {
  pwdError.value = "";
  if (pwd.next !== pwd.confirm) return (pwdError.value = "Les deux mots de passe ne correspondent pas.");
  try {
    await api.auth.changePassword({ currentPassword: pwd.current, newPassword: pwd.next });
    Object.assign(pwd, { current: "", next: "", confirm: "" });
    toast.success("Mot de passe modifié. Vos autres appareils ont été déconnectés.");
  } catch (e) {
    pwdError.value = errorMessage(e);
  }
}

// --- Utilisateurs
const users = ref<UserDTO[]>([]);
const userForm = reactive({ open: false, email: "", displayName: "", role: "trainer" as Role, password: "" });
const userError = ref("");
async function loadUsers() {
  users.value = (await api.users.list({ includeDisabled: true })).items;
}
async function createUser() {
  userError.value = "";
  try {
    await api.users.create({ email: userForm.email, displayName: userForm.displayName, role: userForm.role, password: userForm.password });
    toast.success("Compte créé.");
    Object.assign(userForm, { open: false, email: "", displayName: "", role: "trainer", password: "" });
    loadUsers();
  } catch (e) {
    userError.value = errorMessage(e);
  }
}
async function updateUser(u: UserDTO, patch: Parameters<typeof api.users.update>[1], message: string) {
  try {
    await api.users.update(u.id, patch);
    toast.success(message);
    loadUsers();
  } catch (e) {
    toast.error(e);
    loadUsers();
  }
}
async function toggleDisabled(u: UserDTO) {
  if (!u.disabledAt && !(await confirm({ title: "Désactiver le compte", message: `${u.displayName} sera déconnecté de tous ses appareils.`, confirmLabel: "Désactiver", danger: true }))) return;
  updateUser(u, { disabled: !u.disabledAt }, u.disabledAt ? "Compte réactivé." : "Compte désactivé.");
}
const resetFor = ref<UserDTO | null>(null);
const resetPassword = ref("");
async function doReset() {
  if (!resetFor.value) return;
  await updateUser(resetFor.value, { password: resetPassword.value }, "Mot de passe réinitialisé.");
  resetFor.value = null;
  resetPassword.value = "";
}

// --- Audit
const audit = ref<AuditLogDTO[]>([]);
const auditAction = ref("");
const auditDone = ref(false);
async function loadAudit(more = false) {
  const before = more ? audit.value.at(-1)?.id : undefined;
  const { items } = await api.audit.list({ limit: 50, before, action: auditAction.value || undefined });
  audit.value = more ? [...audit.value, ...items] : items;
  auditDone.value = items.length < 50;
}
watch(auditAction, () => loadAudit());

// --- Système
const health = ref<HealthResponse | null>(null);

watch(
  tab,
  async (t) => {
    try {
      if (t === "users") await loadUsers();
      if (t === "audit") await loadAudit();
      if (t === "system") health.value = await api.health();
    } catch (e) {
      toast.error(e);
    }
  },
  { immediate: true },
);

const ACTIONS = [
  "ATTENDANCE_VALIDATED",
  "ATTENDANCE_CANCELLED",
  "QR_SCANNED",
  "QR_GENERATED",
  "QR_REGENERATED",
  "SESSION_CREATED",
  "SESSION_UPDATED",
  "SESSION_COMPLETED",
  "SESSION_CANCELLED",
  "PARTICIPANT_ADDED",
  "PARTICIPANT_REMOVED",
  "REPORT_GENERATED",
  "USER_LOGIN",
  "USER_LOGIN_FAILED",
  "USER_ROLE_CHANGED",
];
const metaText = (m: Record<string, unknown> | null) =>
  m
    ? Object.entries(m)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
        .join(" · ")
    : "";
</script>

<template>
  <div>
    <PageHeader title="Paramètres" />
    <div class="tabs" role="tablist">
      <button v-for="t in tabs" :key="t.id" type="button" role="tab" :aria-selected="tab === t.id" :class="{ active: tab === t.id }" @click="tab = t.id">
        {{ t.label }}
      </button>
    </div>

    <div class="tab-body">
      <!-- Mon compte -->
      <section v-if="tab === 'account'" class="card card-body narrow">
        <div class="stack">
          <div>
            <h2>{{ user?.displayName }}</h2>
            <p class="muted">{{ user?.email }} · {{ user ? ROLE_LABELS[user.role] : "" }}</p>
          </div>
          <form class="stack" @submit.prevent="changePassword">
            <h3>Changer le mot de passe</h3>
            <label class="field"><span>Mot de passe actuel</span><input v-model="pwd.current" class="input" type="password" autocomplete="current-password" required /></label>
            <label class="field"><span>Nouveau mot de passe</span><input v-model="pwd.next" class="input" type="password" autocomplete="new-password" minlength="12" required /><small>12 caractères minimum.</small></label>
            <label class="field"><span>Confirmation</span><input v-model="pwd.confirm" class="input" type="password" autocomplete="new-password" required /></label>
            <p v-if="pwdError" class="form-error">{{ pwdError }}</p>
            <div><button class="btn btn-primary" type="submit">Modifier</button></div>
          </form>
        </div>
      </section>

      <!-- Utilisateurs -->
      <section v-if="tab === 'users'" class="card">
        <header class="card-header">
          <h2>Comptes</h2>
          <button class="btn btn-primary btn-sm" type="button" @click="userForm.open = true"><AppIcon name="plus" /> Nouveau compte</button>
        </header>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>E-mail</th>
                <th>Rôle</th>
                <th>Statut</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in users" :key="u.id" :class="{ inactive: u.disabledAt }">
                <td><strong>{{ u.displayName }}</strong></td>
                <td>{{ u.email }}</td>
                <td>
                  <select class="input role-select" :value="u.role" :disabled="u.id === user?.id" @change="updateUser(u, { role: ($event.target as HTMLSelectElement).value as Role }, 'Rôle modifié.')">
                    <option v-for="(label, r) in ROLE_LABELS" :key="r" :value="r">{{ label }}</option>
                  </select>
                </td>
                <td><span class="badge" :class="u.disabledAt ? 'badge-danger' : 'badge-success'">{{ u.disabledAt ? "Désactivé" : "Actif" }}</span></td>
                <td class="text-right nowrap">
                  <button class="btn btn-sm" type="button" @click="resetFor = u">Mot de passe</button>
                  <button v-if="u.id !== user?.id" class="btn btn-sm btn-ghost" type="button" @click="toggleDisabled(u)">{{ u.disabledAt ? "Réactiver" : "Désactiver" }}</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Audit -->
      <section v-if="tab === 'audit'" class="card">
        <header class="card-header">
          <h2>Journal d'audit</h2>
          <select v-model="auditAction" class="input role-select" aria-label="Filtrer par action">
            <option value="">Toutes les actions</option>
            <option v-for="a in ACTIONS" :key="a" :value="a">{{ a }}</option>
          </select>
        </header>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Utilisateur</th>
                <th>Action</th>
                <th>Objet</th>
                <th>Détails</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in audit" :key="a.id">
                <td class="nowrap">{{ fmt.dateTime(a.timestamp) }}</td>
                <td>{{ a.actor?.displayName ?? "système" }}</td>
                <td><span class="badge" :class="a.action.includes('FAILED') ? 'badge-danger' : ''">{{ a.action }}</span></td>
                <td class="subtle">{{ a.entityType }}</td>
                <td class="subtle meta">{{ metaText(a.metadata) }}</td>
              </tr>
            </tbody>
          </table>
          <EmptyState v-if="!audit.length" title="Aucune entrée" />
        </div>
        <div v-if="!auditDone && audit.length" class="card-body"><button class="btn btn-sm" type="button" @click="loadAudit(true)">Charger plus</button></div>
      </section>

      <!-- Système -->
      <section v-if="tab === 'system'" class="card card-body narrow">
        <dl class="system">
          <dt>Version</dt>
          <dd>{{ config.public.appVersion }}</dd>
          <dt>Fuseau d'affichage</dt>
          <dd>{{ config.public.timezone }}</dd>
          <dt>Base de données</dt>
          <dd><span class="badge" :class="health?.database === 'ok' ? 'badge-success' : 'badge-danger'">{{ health?.database ?? "…" }}</span></dd>
          <dt>Service PDF</dt>
          <dd><span class="badge" :class="health?.pdfService === 'ok' ? 'badge-success' : 'badge-warning'">{{ health?.pdfService ?? "…" }}</span></dd>
        </dl>
      </section>
    </div>

    <AppModal :open="userForm.open" title="Nouveau compte" @close="userForm.open = false">
      <form id="user-form" class="form-grid" @submit.prevent="createUser">
        <label class="field"><span>Nom affiché</span><input v-model="userForm.displayName" class="input" required maxlength="120" /></label>
        <label class="field">
          <span>Rôle</span>
          <select v-model="userForm.role" class="input">
            <option v-for="(label, r) in ROLE_LABELS" :key="r" :value="r">{{ label }}</option>
          </select>
        </label>
        <label class="field full"><span>E-mail</span><input v-model="userForm.email" class="input" type="email" required /></label>
        <label class="field full"><span>Mot de passe initial</span><input v-model="userForm.password" class="input" type="password" minlength="12" required autocomplete="new-password" /><small>12 caractères minimum ; à transmettre de façon sûre.</small></label>
        <p v-if="userError" class="form-error full">{{ userError }}</p>
      </form>
      <template #footer>
        <button class="btn" type="button" @click="userForm.open = false">Annuler</button>
        <button class="btn btn-primary" type="submit" form="user-form">Créer</button>
      </template>
    </AppModal>

    <AppModal :open="Boolean(resetFor)" title="Réinitialiser le mot de passe" width="440px" @close="resetFor = null">
      <form id="reset-form" class="stack" @submit.prevent="doReset">
        <p class="muted">{{ resetFor?.displayName }} sera déconnecté de tous ses appareils.</p>
        <label class="field"><span>Nouveau mot de passe</span><input v-model="resetPassword" class="input" type="password" minlength="12" required autocomplete="new-password" /></label>
      </form>
      <template #footer>
        <button class="btn" type="button" @click="resetFor = null">Annuler</button>
        <button class="btn btn-primary" type="submit" form="reset-form">Réinitialiser</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.tab-body {
  margin-top: 1rem;
}

.narrow {
  max-width: 560px;
}

.role-select {
  width: auto;
  min-height: 30px;
  padding: 0.2rem 0.5rem;
}

.meta {
  max-width: 420px;
  font-size: 0.8rem;
  word-break: break-word;
}

.system {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.6rem 1.5rem;
  margin: 0;
}

.system dt {
  color: var(--muted);
}

.system dd {
  margin: 0;
  font-weight: 600;
}
</style>
