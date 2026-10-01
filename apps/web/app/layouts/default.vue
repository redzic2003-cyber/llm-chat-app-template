<script setup lang="ts">
const { user, logout, can } = useAuth();
const config = useRuntimeConfig();
const route = useRoute();
const menuOpen = ref(false);
watch(() => route.fullPath, () => (menuOpen.value = false));

const nav = computed(() => [
  { to: "/", label: "Dashboard", icon: "dashboard" },
  { to: "/calendar", label: "Calendrier", icon: "calendar" },
  { to: "/trainings", label: "Formations", icon: "book" },
  { to: "/participants", label: "Participants", icon: "users" },
  { to: "/reports", label: "Rapports", icon: "file" },
  { to: "/settings", label: "Paramètres", icon: "settings" },
]);

const isActive = (to: string) => (to === "/" ? route.path === "/" : route.path.startsWith(to) || (to === "/calendar" && route.path.startsWith("/sessions")));
</script>

<template>
  <div class="shell">
    <aside class="sidebar no-print" :class="{ open: menuOpen }">
      <div class="brand">
        <img src="/favicon.svg" alt="" width="28" height="28" />
        <div>
          <strong>{{ config.public.appName }}</strong>
          <span class="subtle">Formations & présences</span>
        </div>
      </div>
      <nav>
        <NuxtLink v-for="item in nav" :key="item.to" :to="item.to" class="nav-link" :class="{ active: isActive(item.to) }">
          <AppIcon :name="item.icon" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </nav>
      <div class="sidebar-footer">
        <div class="user">
          <strong>{{ user?.displayName }}</strong>
          <span class="subtle">{{ user ? ROLE_LABELS[user.role] : "" }}</span>
        </div>
        <button class="btn btn-ghost btn-sm" type="button" title="Se déconnecter" @click="logout">
          <AppIcon name="logout" />
        </button>
      </div>
      <p v-if="can('users:manage')" class="version subtle">v{{ config.public.appVersion }}</p>
    </aside>
    <div class="main-area">
      <header class="topbar no-print">
        <button class="btn btn-ghost btn-sm" type="button" aria-label="Menu" @click="menuOpen = !menuOpen">
          <AppIcon name="menu" />
        </button>
        <strong>{{ config.public.appName }}</strong>
      </header>
      <main class="content">
        <slot />
      </main>
    </div>
    <ToastHost />
    <ConfirmHost />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 232px;
  height: 100vh;
  flex-shrink: 0;
  padding: 1.1rem 0.85rem;
  background: var(--surface);
  border-right: 1px solid var(--border);
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0 0.4rem 0.6rem;
}

.brand div {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

nav {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.7rem;
  border-radius: var(--radius-sm);
  color: var(--muted);
  font-weight: 550;
}

.nav-link:hover {
  background: var(--surface-2);
  color: var(--text);
  text-decoration: none;
}

.nav-link.active {
  background: var(--accent-weak);
  color: var(--accent);
}

.sidebar-footer {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.75rem 0.4rem 0;
  border-top: 1px solid var(--border);
}

.user {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  min-width: 0;
}

.user strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.version {
  padding: 0 0.4rem;
}

.main-area {
  flex: 1;
  min-width: 0;
}

.content {
  max-width: 1320px;
  margin: 0 auto;
  padding: 1.75rem 2rem 3rem;
}

.topbar {
  display: none;
}

@media (max-width: 900px) {
  .sidebar {
    position: fixed;
    z-index: 50;
    left: 0;
    transform: translateX(-100%);
    transition: transform 0.2s;
    box-shadow: var(--shadow-lg);
  }

  .sidebar.open {
    transform: none;
  }

  .topbar {
    position: sticky;
    top: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }

  .content {
    padding: 1.25rem 1rem 2.5rem;
  }
}
</style>
