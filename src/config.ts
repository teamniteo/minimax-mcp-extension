import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Runtime configuration, read from environment variables that the desktop
 * extension populates from user_config (see manifest.json).
 */
export interface MinimaxConfig {
  developerId: string;
  developerPassword: string;
  orgId: string;
  orgPassword: string;
  baseUrl: string;
  tokenUrl: string;
  scope: string;
}

const DEFAULT_BASE_URL = "https://moj.minimax.si/SI/API/";
const DEFAULT_TOKEN_URL = "https://moj.minimax.si/si/aut/oauth20/token";
const DEFAULT_SCOPE = "minimax.si";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): MinimaxConfig {
  const required = (name: string): string => {
    const value = env[name];
    if (!value || value.trim() === "") {
      throw new Error(
        `Missing required configuration: ${name}. Set it in the extension settings.`,
      );
    }
    return value;
  };

  return {
    developerId: required("MINIMAX_DEVELOPER_ID"),
    developerPassword: required("MINIMAX_DEVELOPER_PASSWORD"),
    orgId: required("MINIMAX_ORG_ID"),
    orgPassword: required("MINIMAX_ORG_PASSWORD"),
    baseUrl: env.MINIMAX_BASE_URL?.trim() || DEFAULT_BASE_URL,
    tokenUrl: env.MINIMAX_TOKEN_URL?.trim() || DEFAULT_TOKEN_URL,
    scope: env.MINIMAX_SCOPE?.trim() || DEFAULT_SCOPE,
  };
}

interface CachedToken {
  accessToken: string;
  expiresAt: number; // unix seconds
}

// Refresh this many seconds before the real expiry (matches the Go 5-minute buffer).
const EXPIRY_BUFFER_SECONDS = 5 * 60;

/**
 * Handles OAuth2 password-grant authentication against Minimax and caches the
 * resulting token (in memory and in a small temp file) until shortly before it
 * expires. Mirrors the behaviour of the original Go config.go.
 */
export class TokenProvider {
  private token: CachedToken | null = null;
  private readonly cacheFile: string;

  constructor(private readonly config: MinimaxConfig) {
    const fingerprint = createHash("sha256")
      .update(`${config.tokenUrl}|${config.developerId}|${config.orgId}`)
      .digest("hex")
      .slice(0, 16);
    this.cacheFile = join(tmpdir(), `minimax-mcp-token-${fingerprint}.json`);
    this.loadFromDisk();
  }

  private nowSeconds(): number {
    return Math.floor(Date.now() / 1000);
  }

  private isExpired(): boolean {
    return this.token === null || this.nowSeconds() >= this.token.expiresAt;
  }

  private loadFromDisk(): void {
    try {
      const raw = readFileSync(this.cacheFile, "utf8");
      const parsed = JSON.parse(raw) as CachedToken;
      if (parsed.accessToken && typeof parsed.expiresAt === "number") {
        this.token = parsed;
      }
    } catch {
      // No cache yet or unreadable — ignore and fetch fresh.
    }
  }

  private saveToDisk(): void {
    try {
      writeFileSync(this.cacheFile, JSON.stringify(this.token), {
        mode: 0o600,
      });
    } catch {
      // Cache is best-effort; failure to persist is non-fatal.
    }
  }

  /** Returns a valid access token, refreshing it if necessary. */
  async getToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh && !this.isExpired() && this.token) {
      return this.token.accessToken;
    }
    return this.refresh();
  }

  private async refresh(): Promise<string> {
    const body = new URLSearchParams({
      grant_type: "password",
      client_id: this.config.developerId,
      client_secret: this.config.developerPassword,
      username: this.config.orgId,
      password: this.config.orgPassword,
      scope: this.config.scope,
    });

    const resp = await fetch(this.config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const text = await resp.text();
    if (!resp.ok) {
      throw new Error(`Token request returned status ${resp.status}: ${text}`);
    }

    let parsed: {
      access_token?: string;
      token_type?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`Failed to parse token response: ${text}`);
    }

    if (parsed.error) {
      throw new Error(
        `OAuth2 error: ${parsed.error} - ${parsed.error_description ?? ""}`,
      );
    }
    if (!parsed.access_token) {
      throw new Error("No access token in response");
    }

    const expiresIn = parsed.expires_in ?? 3600;
    this.token = {
      accessToken: parsed.access_token,
      expiresAt: this.nowSeconds() + expiresIn - EXPIRY_BUFFER_SECONDS,
    };
    this.saveToDisk();
    return this.token.accessToken;
  }
}
