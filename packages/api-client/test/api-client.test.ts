import { describe, expect, it, vi } from "vitest";
import { ApiClientError, createApiClient } from "../src/index";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("api-client", () => {
  it("envoie le token Bearer et sérialise la requête", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      jsonResponse(200, { status: "ok", enrollmentId: "e1" }),
    );
    const api = createApiClient({ baseUrl: "https://formations.example.ch/", getToken: () => "tok", fetch: fetchMock as typeof fetch });
    await api.scans.resolve({ payload: "TRN1:abc", sessionId: "s1" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://formations.example.ch/api/v1/scans/resolve");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).authorization).toBe("Bearer tok");
    expect(JSON.parse(init?.body as string)).toEqual({ payload: "TRN1:abc", sessionId: "s1" });
  });

  it("construit les query strings en ignorant les valeurs vides", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => jsonResponse(200, { items: [] }));
    const api = createApiClient({ baseUrl: "", fetch: fetchMock as typeof fetch });
    await api.participants.list({ q: "dup", includeInactive: undefined, limit: 20 });
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/v1/participants?q=dup&limit=20");
  });

  it("traduit le format d'erreur uniforme", async () => {
    const onUnauthorized = vi.fn();
    const fetchMock = vi.fn(async () =>
      jsonResponse(409, { error: { code: "ATTENDANCE_ALREADY_VALIDATED", message: "Présence déjà validée.", details: { validatedAt: "x" } } }),
    );
    const api = createApiClient({ baseUrl: "", fetch: fetchMock as typeof fetch, onUnauthorized });
    const err = await api.attendance.validate("e1", { idempotencyKey: "k".repeat(10) }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err).toMatchObject({ status: 409, code: "ATTENDANCE_ALREADY_VALIDATED", details: { validatedAt: "x" } });
    expect(onUnauthorized).not.toHaveBeenCalled();

    const unauthorized = createApiClient({
      baseUrl: "",
      fetch: (async () => new Response("nope", { status: 401 })) as typeof fetch,
      onUnauthorized,
    });
    await expect(unauthorized.auth.session()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("signale un serveur injoignable", async () => {
    const api = createApiClient({ baseUrl: "", fetch: (async () => { throw new TypeError("network"); }) as typeof fetch });
    await expect(api.auth.session()).rejects.toMatchObject({ status: 0 });
  });
});
