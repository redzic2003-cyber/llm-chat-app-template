import { ApiClientError, createApiClient, type ApiClient } from "@tm/api-client";

let client: ApiClient | undefined;

/** Client API (même origine, cookie HttpOnly). Un 401 renvoie vers la page de connexion. */
export function useApi(): ApiClient {
  client ??= createApiClient({
    baseUrl: "",
    onUnauthorized: () => {
      const route = useRoute();
      useState("auth-user").value = null;
      if (route.path !== "/login") navigateTo({ path: "/login", query: { redirect: route.fullPath } });
    },
  });
  return client;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return "Une erreur inattendue est survenue.";
}

export { ApiClientError };
