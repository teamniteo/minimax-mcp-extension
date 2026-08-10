import type { MinimaxConfig, TokenProvider } from "./config.js";

// Organisations this server must never touch, blocked at the HTTP layer so
// every tool (explicit and generic) is covered.
const BLOCKED_ORGS: Record<string, string> = {
  "115976": "KLEOS d.o.o.",
};

export interface ApiResponse {
  statusCode: number;
  body: unknown;
  /** Location header of a created resource (POST 201), if present. */
  location?: string;
  /** New resource ID parsed from the Location header, if present. */
  createdId?: string;
}

/**
 * Thin HTTP client for the Minimax API: a JSON request helper attaching a
 * bearer token that is refreshed on demand.
 */
export class ApiClient {
  constructor(
    private readonly config: MinimaxConfig,
    private readonly tokens: TokenProvider,
  ) {}

  private buildUrl(endpoint: string): string {
    const base = this.config.baseUrl.replace(/\/+$/, "");
    const path = endpoint.replace(/^\/+/, "");
    return `${base}/${path}`;
  }

  private async parse(resp: Response): Promise<ApiResponse> {
    const text = await resp.text();
    let body: unknown = text;
    const contentType = resp.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    // Capture the Location header so callers can get a created resource's ID
    // without a follow-up list/search request.
    const location = resp.headers.get("location") ?? undefined;
    const createdId = location?.match(/\/(\d+)(?:[/?#].*)?$/)?.[1];
    return { statusCode: resp.status, body, location, createdId };
  }

  /** Perform a JSON API call (GET/POST/PUT/DELETE). */
  async callApi(
    method: string,
    endpoint: string,
    data?: unknown,
  ): Promise<ApiResponse> {
    const orgId = endpoint.match(/\/api\/orgs\/(\d+)/)?.[1];
    if (orgId !== undefined && BLOCKED_ORGS[orgId]) {
      throw new Error(
        `Access to organisation ${orgId} (${BLOCKED_ORGS[orgId]}) is blocked in this server.`,
      );
    }
    let resp = await this.request(method, endpoint, data, false);
    // Minimax invalidates the previous token when a new one is issued for the
    // same user (e.g. by another client using the same credentials), so a
    // cached token can die before its expiry. Re-authenticate once and retry.
    if (resp.status === 401) {
      resp = await this.request(method, endpoint, data, true);
    }
    const parsed = await this.parse(resp);
    // Hide blocked organisations from the organisation listing as well.
    if (endpoint.includes("/api/currentuser/orgs")) {
      const body = parsed.body as { Rows?: { Organisation?: { ID?: number } }[] };
      if (Array.isArray(body?.Rows)) {
        body.Rows = body.Rows.filter(
          (r) => !BLOCKED_ORGS[String(r.Organisation?.ID ?? "")],
        );
      }
    }
    return parsed;
  }

  private async request(
    method: string,
    endpoint: string,
    data: unknown,
    forceRefresh: boolean,
  ): Promise<Response> {
    const token = await this.tokens.getToken(forceRefresh);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    let payload: string | undefined;
    if (data !== undefined && data !== null) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(data);
    }
    return fetch(this.buildUrl(endpoint), { method, headers, body: payload });
  }
}
