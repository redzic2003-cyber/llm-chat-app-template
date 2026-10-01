<script setup lang="ts">
definePageMeta({ layout: "bare" });

const { login } = useAuth();
const route = useRoute();
const config = useRuntimeConfig();
const email = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);

async function submit() {
  error.value = "";
  loading.value = true;
  try {
    await login(email.value, password.value);
    const redirect = typeof route.query.redirect === "string" && route.query.redirect.startsWith("/") ? route.query.redirect : "/";
    await navigateTo(redirect);
  } catch (e) {
    error.value = errorMessage(e);
    password.value = "";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login">
    <form class="card login-card" @submit.prevent="submit">
      <div class="login-brand">
        <img src="/favicon.svg" alt="" width="40" height="40" />
        <div>
          <h1>{{ config.public.appName }}</h1>
          <p class="muted">Formations, présences et rapports</p>
        </div>
      </div>
      <label class="field">
        <span>Adresse e-mail</span>
        <input v-model="email" class="input" type="email" autocomplete="username" required autofocus />
      </label>
      <label class="field">
        <span>Mot de passe</span>
        <input v-model="password" class="input" type="password" autocomplete="current-password" required />
      </label>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <button class="btn btn-primary" type="submit" :disabled="loading">{{ loading ? "Connexion…" : "Connexion" }}</button>
    </form>
  </div>
</template>

<style scoped>
.login {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 1rem;
}

.login-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: min(400px, 100%);
  padding: 2rem;
}

.login-brand {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin-bottom: 0.5rem;
}
</style>
