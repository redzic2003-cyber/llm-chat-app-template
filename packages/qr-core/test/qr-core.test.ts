import { describe, expect, it } from "vitest";
import {
  QR_PREFIX,
  TOKEN_LENGTH,
  formatPayload,
  generateToken,
  hashTokenAsync,
  isWellFormedToken,
  parsePayload,
} from "../src/index";
import { generateTokenNode, hashPayload, hashToken, issueToken } from "../src/node";

describe("tokens", () => {
  it("génère 32 octets en Base64URL sans padding (43 caractères)", () => {
    for (const token of [generateToken(), generateTokenNode()]) {
      expect(token).toHaveLength(TOKEN_LENGTH);
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(Buffer.from(token, "base64url")).toHaveLength(32);
    }
  });

  it("ne produit pas de collisions sur un grand échantillon", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(generateTokenNode());
    expect(seen.size).toBe(5000);
  });

  it("hache en SHA-256 hexadécimal, identique en Node et Web Crypto", async () => {
    const token = generateToken();
    const digest = hashToken(token);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashTokenAsync(token)).toBe(digest);
  });
});

describe("payload TRN1", () => {
  it("formate et relit un payload", () => {
    const token = generateToken();
    const payload = formatPayload(token);
    expect(payload).toBe(`${QR_PREFIX}${token}`);
    expect(parsePayload(payload)).toEqual({ ok: true, version: "TRN1", token });
  });

  it("tolère les blancs ajoutés par les lecteurs", () => {
    const token = generateToken();
    expect(parsePayload(`  TRN1:${token}\n`)).toMatchObject({ ok: true, token });
  });

  it("refuse les contenus étrangers ou mal formés", () => {
    expect(parsePayload("")).toEqual({ ok: false, reason: "empty" });
    expect(parsePayload("https://example.com/p/123")).toEqual({ ok: false, reason: "prefix" });
    expect(parsePayload("trn1:" + generateToken())).toEqual({ ok: false, reason: "prefix" });
    expect(parsePayload("TRN1:trop-court")).toEqual({ ok: false, reason: "format" });
    expect(parsePayload("TRN1:" + generateToken() + "x")).toEqual({ ok: false, reason: "format" });
    expect(parsePayload("TRN1:" + "a".repeat(42) + "=")).toEqual({ ok: false, reason: "format" });
    expect(isWellFormedToken("Jean Dupont")).toBe(false);
    expect(() => formatPayload("pas un token")).toThrow();
  });

  it("issueToken renvoie un payload dont le hash correspond", () => {
    const issued = issueToken();
    const resolved = hashPayload(issued.payload);
    expect(resolved).toEqual({ ok: true, hash: issued.hash });
    // Le payload ne contient que le préfixe et le token.
    expect(issued.payload).toMatch(/^TRN1:[A-Za-z0-9_-]{43}$/);
  });
});
