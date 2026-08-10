import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient, ApiResponse } from "./apiClient.js";

type Op = "list" | "get" | "create" | "update" | "delete";

interface ResourceDef {
  /** Path under /api/orgs/{organisationId}/. May contain a {parentId} segment. */
  path: string;
  ops: readonly Op[];
  /** What {parentId} refers to, when the path is nested. */
  parent?: string;
  /** Resource supports lookup by code via /code({code}). */
  codeLookup?: boolean;
  /** Override path for the list operation (e.g. postal codes list by country). */
  listPath?: string;
  description: string;
}

/**
 * Registry of Minimax API resources exposed through the generic CRUD tools.
 * Endpoint shapes taken from https://moj.minimax.si/SI/API/Home/ModuleDetails/{Module}.
 */
const RESOURCES: Record<string, ResourceDef> = {
  accounts: {
    path: "accounts",
    ops: ["list", "get"],
    codeLookup: true,
    description: "Chart of accounts (read-only)",
  },
  addresses: {
    path: "customers/{parentId}/addresses",
    ops: ["list", "get", "create", "update", "delete"],
    parent: "customer ID",
    description: "Customer addresses",
  },
  analytics: {
    path: "analytics",
    ops: ["list", "get", "create", "update", "delete"],
    description: "Analytics (cost centres)",
  },
  bankAccounts: {
    path: "customers/{parentId}/bankAccounts",
    ops: ["list", "get", "create", "update", "delete"],
    parent: "customer ID",
    description: "Customer bank accounts",
  },
  contacts: {
    path: "customers/{parentId}/contacts",
    ops: ["list", "get", "create", "update", "delete"],
    parent: "customer ID",
    listPath: "contacts",
    description:
      "Customer contacts (list without parentId returns all organisation contacts)",
  },
  countries: {
    path: "countries",
    ops: ["list", "get"],
    codeLookup: true,
    description: "Countries (read-only)",
  },
  currencies: {
    path: "currencies",
    ops: ["list", "get"],
    codeLookup: true,
    description: "Currencies (read-only)",
  },
  customers: {
    path: "customers",
    ops: ["list", "get", "create", "update", "delete"],
    codeLookup: true,
    description: "Customers and suppliers",
  },
  dashboards: {
    path: "dashboards",
    ops: ["list"],
    description: "Dashboard data (read-only)",
  },
  documentNumbering: {
    path: "document-numbering",
    ops: ["list", "get"],
    description: "Document numbering schemes (read-only)",
  },
  documents: {
    path: "documents",
    ops: ["list", "get", "create", "update", "delete"],
    description: "Documents",
  },
  employees: {
    path: "employees",
    ops: ["list", "get", "create", "update", "delete"],
    description: "Employees",
  },
  exchangeRates: {
    path: "exchange-rates",
    ops: ["get"],
    codeLookup: true,
    description:
      "Exchange rates: get by currency ID or code, pass { date: 'YYYY-MM-DD' } in filters",
  },
  inbox: {
    path: "inbox",
    ops: ["list", "get", "delete"],
    description: "Inbox (received e-documents)",
  },
  issuedInvoicePostings: {
    path: "issuedinvoicepostings",
    ops: ["list", "get", "create", "delete"],
    description: "Issued invoice postings (register/POS invoices)",
  },
  issuedInvoices: {
    path: "issuedinvoices",
    ops: ["list", "get", "create", "update", "delete"],
    description:
      "Issued invoices (prefer create_issued_invoice for creating; use perform_issued_invoice_action for issue/PDF actions)",
  },
  items: {
    path: "items",
    ops: ["list", "get", "create", "update", "delete"],
    codeLookup: true,
    description: "Items (prefer create_item for creating)",
  },
  journalTypes: {
    path: "journaltypes",
    ops: ["list", "get"],
    codeLookup: true,
    description: "Journal types (read-only)",
  },
  journalVats: {
    path: "journals/{parentId}/vat",
    ops: ["get", "create", "update", "delete"],
    parent: "journal ID",
    description: "VAT entries of a journal",
  },
  journals: {
    path: "journals",
    ops: ["list", "get", "create", "update", "delete"],
    description: "Accounting journals (temeljnice)",
  },
  orders: {
    path: "orders",
    ops: ["list", "get", "create", "update", "delete"],
    description: "Orders",
  },
  outbox: {
    path: "outbox",
    ops: ["list", "get"],
    description: "Outbox (sent e-documents, read-only)",
  },
  paymentMethods: {
    path: "paymentMethods",
    ops: ["list"],
    description: "Payment methods (read-only)",
  },
  postalCodes: {
    path: "postalcodes",
    ops: ["list", "get"],
    parent: "country ID (required for list)",
    listPath: "postalcodes/countries/{parentId}",
    description: "Postal codes (read-only)",
  },
  productGroups: {
    path: "productGroups",
    ops: ["list", "get", "create", "update", "delete"],
    description: "Product groups",
  },
  purposeCodes: {
    path: "purpose-codes",
    ops: ["list", "get"],
    codeLookup: true,
    description: "Payment purpose codes (read-only)",
  },
  receivedInvoices: {
    path: "receivedinvoices",
    ops: ["list", "get", "create", "update", "delete"],
    description:
      "Received (supplier) invoices (prefer create_received_invoice for creating)",
  },
  reportTemplates: {
    path: "report-templates",
    ops: ["list", "get"],
    description: "Report templates (read-only)",
  },
  stockEntries: {
    path: "stockentry",
    ops: ["list", "get", "create", "update", "delete"],
    description: "Stock entries (inventory receipts and issues)",
  },
  stocks: {
    path: "stocks",
    ops: ["list", "get"],
    description: "Stock levels (read-only; get by item ID)",
  },
  vatAccountingTypes: {
    path: "vataccountingtypes",
    ops: ["list"],
    description: "VAT accounting types (read-only; filter by { date })",
  },
  vatRates: {
    path: "vatrates",
    ops: ["list", "get"],
    codeLookup: true,
    description: "VAT rates (read-only; filter by { date, countryID })",
  },
  warehouses: {
    path: "warehouses",
    ops: ["list", "get", "create", "update", "delete"],
    description: "Warehouses",
  },
};

const resourceNames = Object.keys(RESOURCES) as [string, ...string[]];

const resourceParam = z
  .enum(resourceNames)
  .describe("The Minimax resource to operate on");

const filtersParam = z
  .record(z.union([z.string(), z.number()]))
  .optional()
  .describe(
    "Optional query parameters, e.g. { CurrentPage: 1, PageSize: 50, SearchString: '...', date: 'YYYY-MM-DD' }",
  );

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

function ok(label: string, resp: ApiResponse): ToolResult {
  const body =
    typeof resp.body === "string"
      ? resp.body
      : JSON.stringify(resp.body, null, 2);
  const created = resp.createdId ? `\nCreated ID: ${resp.createdId}` : "";
  return {
    content: [
      { type: "text", text: `${label} (HTTP ${resp.statusCode}):${created}\n${body}` },
    ],
  };
}

function fail(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

function guard(
  fn: (args: Record<string, unknown>) => Promise<ToolResult>,
): (args: Record<string, unknown>) => Promise<ToolResult> {
  return async (args) => {
    try {
      return await fn(args);
    } catch (err) {
      return fail(`API call failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
}

function query(pairs: Record<string, unknown> | undefined): string {
  if (!pairs) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(pairs)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

/**
 * Resolve the collection endpoint for a resource, substituting {parentId}.
 * Throws a user-facing error when a required parentId is missing.
 */
function collectionPath(
  resource: string,
  organisationId: string,
  parentId: string | undefined,
  op: Op,
): string {
  const def = RESOURCES[resource];
  if (!def.ops.includes(op)) {
    throw new Error(
      `Resource '${resource}' does not support '${op}'. Supported operations: ${def.ops.join(", ")}.`,
    );
  }
  let path = op === "list" && def.listPath !== undefined ? def.listPath : def.path;
  if (path.includes("{parentId}")) {
    if (!parentId) {
      throw new Error(
        `Resource '${resource}' requires parentId (${def.parent ?? "parent record ID"}) for '${op}'.`,
      );
    }
    path = path.replace("{parentId}", encodeURIComponent(parentId));
  }
  return `/api/orgs/${organisationId}/${path}`;
}

/** One line per resource so the model can see what each tool supports. */
function resourceCatalog(op: Op): string {
  return Object.entries(RESOURCES)
    .filter(([, def]) => def.ops.includes(op))
    .map(([name, def]) => {
      const parent = def.parent ? ` (parentId = ${def.parent})` : "";
      return `${name}${parent}: ${def.description}`;
    })
    .join("; ");
}

export function registerCrudTools(server: McpServer, api: ApiClient): void {
  server.tool(
    "minimax_list",
    `List records of a Minimax resource. Resources: ${resourceCatalog("list")}`,
    {
      resource: resourceParam,
      organisationId: z.string().describe("The organization ID"),
      parentId: z
        .string()
        .optional()
        .describe("Parent record ID for nested resources (see resource list)"),
      filters: filtersParam,
    },
    guard(async ({ resource, organisationId, parentId, filters }) =>
      ok(
        `${String(resource)} list`,
        await api.callApi(
          "GET",
          collectionPath(
            resource as string,
            organisationId as string,
            parentId as string | undefined,
            "list",
          ) + query(filters as Record<string, unknown> | undefined),
        ),
      ),
    ),
  );

  server.tool(
    "minimax_get",
    `Get a single Minimax record by ID, or by code for resources that support it. Resources: ${resourceCatalog("get")}`,
    {
      resource: resourceParam,
      organisationId: z.string().describe("The organization ID"),
      id: z.string().optional().describe("Record ID"),
      code: z
        .string()
        .optional()
        .describe("Record code, alternative to id (only for resources with codes)"),
      parentId: z
        .string()
        .optional()
        .describe("Parent record ID for nested resources (see resource list)"),
      filters: filtersParam,
    },
    guard(async ({ resource, organisationId, id, code, parentId, filters }) => {
      const base = collectionPath(
        resource as string,
        organisationId as string,
        parentId as string | undefined,
        "get",
      );
      let endpoint: string;
      if (code !== undefined && code !== "") {
        if (!RESOURCES[resource as string].codeLookup) {
          return fail(`Resource '${String(resource)}' does not support lookup by code; pass id instead.`);
        }
        endpoint = `${base}/code(${encodeURIComponent(code as string)})`;
      } else if (id !== undefined && id !== "") {
        endpoint = `${base}/${encodeURIComponent(id as string)}`;
      } else {
        return fail("Either id or code is required.");
      }
      return ok(
        `${String(resource)} record`,
        await api.callApi("GET", endpoint + query(filters as Record<string, unknown> | undefined)),
      );
    }),
  );

  server.tool(
    "minimax_create",
    `Create a Minimax record. The payload is the resource's Minimax JSON object; reference related records via { ID } fields. Resources: ${resourceCatalog("create")}`,
    {
      resource: resourceParam,
      organisationId: z.string().describe("The organization ID"),
      parentId: z
        .string()
        .optional()
        .describe("Parent record ID for nested resources (see resource list)"),
      payload: z
        .record(z.unknown())
        .describe("The record to create, in Minimax API JSON shape"),
    },
    guard(async ({ resource, organisationId, parentId, payload }) =>
      ok(
        `${String(resource)} created`,
        await api.callApi(
          "POST",
          collectionPath(
            resource as string,
            organisationId as string,
            parentId as string | undefined,
            "create",
          ),
          payload,
        ),
      ),
    ),
  );

  server.tool(
    "minimax_update",
    `Update a Minimax record. Fetch the record with minimax_get first and send back the full object including its RowVersion (concurrency token) with your changes applied. Resources: ${resourceCatalog("update")}`,
    {
      resource: resourceParam,
      organisationId: z.string().describe("The organization ID"),
      id: z.string().describe("Record ID"),
      parentId: z
        .string()
        .optional()
        .describe("Parent record ID for nested resources (see resource list)"),
      payload: z
        .record(z.unknown())
        .describe("The full updated record, including the current RowVersion"),
    },
    guard(async ({ resource, organisationId, id, parentId, payload }) =>
      ok(
        `${String(resource)} updated`,
        await api.callApi(
          "PUT",
          `${collectionPath(
            resource as string,
            organisationId as string,
            parentId as string | undefined,
            "update",
          )}/${encodeURIComponent(id as string)}`,
          payload,
        ),
      ),
    ),
  );

  server.tool(
    "minimax_delete",
    `Delete a Minimax record. Resources: ${resourceCatalog("delete")}`,
    {
      resource: resourceParam,
      organisationId: z.string().describe("The organization ID"),
      id: z.string().describe("Record ID"),
      parentId: z
        .string()
        .optional()
        .describe("Parent record ID for nested resources (see resource list)"),
    },
    guard(async ({ resource, organisationId, id, parentId }) =>
      ok(
        `${String(resource)} deleted`,
        await api.callApi(
          "DELETE",
          `${collectionPath(
            resource as string,
            organisationId as string,
            parentId as string | undefined,
            "delete",
          )}/${encodeURIComponent(id as string)}`,
        ),
      ),
    ),
  );

  server.tool(
    "get_current_user_profile",
    "Get the profile of the current API user - API docs: https://moj.minimax.si/SI/API/Help/Api/GET-api-currentuser-profile",
    {},
    guard(async () => ok("Current user profile", await api.callApi("GET", "/api/currentuser/profile"))),
  );
}
