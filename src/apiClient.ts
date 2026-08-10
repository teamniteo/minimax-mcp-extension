import type { MinimaxConfig, TokenProvider } from "./config.js";

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

  /** Perform a JSON API call (GET/POST/PATCH/DELETE). */
  async callApi(
    method: string,
    endpoint: string,
    data?: unknown,
  ): Promise<ApiResponse> {
    const token = await this.tokens.getToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    let payload: string | undefined;
    if (data !== undefined && data !== null) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(data);
    }

    const resp = await fetch(this.buildUrl(endpoint), {
      method,
      headers,
      body: payload,
    });
    return this.parse(resp);
  }
}
