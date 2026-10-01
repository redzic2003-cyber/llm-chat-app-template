<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { errorText } from "../lib/errors";
import { login, state } from "../lib/store";

const router = useRouter();
const email = ref("");
const password = ref("");
const server = ref(state.baseUrl);
const showServer = ref(!state.baseUrl);
const error = ref("");
const loading = ref(false);

async function submit() {
  error.value = "";
  if (!/^https?:\/\//.test(server.value)) {
    showServer.value = true;
    error.value = "Indiquez l'adresse du serveur (https://…).";
    return;
  }
  loading.value = true;
  try {
    await login(server.value, email.value.trim(), password.value);
    password.value = "";
    await router.replace("/");
  } catch (e) {
    error.value = errorText(e);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <form class="screen login" @submit.prevent="submit">
    <div class="brand">
      <img src="/icon.svg" alt="" width="56" height="56" />
      <h1>Présences</h1>
      <p class="muted">Validation des présences par QR code</p>
    </div>
    <label class="field">
      <span>E-mail</span>
      <input v-model="email" class="input" type="email" autocomplete="username" inputmode="email" required />
    </label>
    <label class="field">
      <span>Mot de passe</span>
      <input v-model="password" class="input" type="password" autocomplete="current-password" required />
    </label>
    <label v-if="showServer" class="field">
      <span>Serveur</span>
      <input v-model="server" class="input" type="url" placeholder="https://formations.example.ch" autocapitalize="off" required />
    </label>
    <button v-else type="button" class="link" @click="showServer = true">Serveur : {{ server }}</button>
    <p v-if="error" class="error-box" role="alert">{{ error }}</p>
    <button class="btn btn-primary btn-xl" type="submit" :disabled="loading">{{ loading ? "Connexion…" : "Connexion" }}</button>
  </form>
</template>

<style scoped>
.login {
  justify-content: center;
  max-width: 440px;
  margin: 0 auto;
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-bottom: 18px;
  text-align: center;
}

.brand h1 {
  margin: 8px 0 0;
}

.link {
  border: 0;
  background: none;
  color: var(--muted);
  font-size: 0.85rem;
  text-align: left;
  padding: 0;
}
</style>
