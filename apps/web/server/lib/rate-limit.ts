/**
 * Limiteur de débit en mémoire (fenêtre glissante). Suffisant pour une instance
 * unique ; le reverse proxy peut ajouter sa propre limite en amont.
 */
import { ApiError } from "./errors";

export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Enregistre une tentative ; renvoie le délai d'attente en secondes si la limite est dépassée. */
  hit(key: string, now = Date.now()): number | null {
    const start = now - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > start);
    if (list.length >= this.limit) {
      this.hits.set(key, list);
      return Math.max(1, Math.ceil((list[0]! + this.windowMs - now) / 1000));
    }
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 10_000) this.prune(now);
    return null;
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  private prune(now: number): void {
    for (const [key, list] of this.hits) {
      if (!list.some((t) => t > now - this.windowMs)) this.hits.delete(key);
    }
  }
}

export function enforce(limiter: RateLimiter, key: string): void {
  const retryAfter = limiter.hit(key);
  if (retryAfter !== null) throw new ApiError("RATE_LIMITED", undefined, { retryAfter });
}

export const limiters = {
  loginByIp: new RateLimiter(30, 15 * 60_000),
  loginByEmail: new RateLimiter(10, 15 * 60_000),
  scan: new RateLimiter(240, 60_000),
  validate: new RateLimiter(240, 60_000),
  reports: new RateLimiter(20, 60_000),
};
