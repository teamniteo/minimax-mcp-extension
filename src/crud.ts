import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient, ApiResponse } from "./apiClient.js";

type Op = "list" | "get" | "create" | "update";

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
    ops: ["list", "get", "create", "update"],
    parent: "customer ID",
    description: "Customer addresses",
  },
  analytics: {
    path: "analytics",
    ops: ["list", "get", "create", "update"],
    description: "Analytics (cost centres)",
  },
  bankAccounts: {
    path: "customers/{parentId}/bankAccounts",
    ops: ["list", "get", "create", "update"],
    parent: "customer ID",
    description: "Customer bank accounts",
  },
  contacts: {
    path: "customers/{parentId}/contacts",
    ops: ["list", "get", "create", "update"],
    parent: "customer ID",
    listPath: "contacts",
    description:
      "Customer contacts (list without parentId returns all organisation contacts; filters: Email)",
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
    ops: ["list", "get", "create", "update"],
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
    ops: ["list", "get", "create", "update"],
    description: "Documents",
  },
  employees: {
    path: "employees",
    ops: ["list", "get", "create", "update"],
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
    ops: ["list", "get"],
    description:
      "Inbox / received e-documents (filters: InboxType, InboxImportStatus, InboxDateFrom/To)",
  },
  issuedInvoicePostings: {
    path: "issuedinvoicepostings",
    ops: ["list", "get", "create"],
    description:
      "Issued invoice postings / register POS invoices (filters: DateFrom/To, Status, AnalyticID)",
  },
  issuedInvoices: {
    path: "issuedinvoices",
    ops: ["list", "get", "create", "update"],
    description:
      "Issued invoices (prefer create_issued_invoice for creating; use perform_issued_invoice_action for issue/PDF actions)",
  },
  items: {
    path: "items",
    ops: ["list", "get", "create", "update"],
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
    ops: ["get", "create", "update"],
    parent: "journal ID",
    description: "VAT entries of a journal",
  },
  journals: {
    path: "journals",
    ops: ["list", "get", "create", "update"],
    description:
      "Accounting journals / temeljnice (filters: DateFrom/To, JournalId, JournalType, Status)",
  },
  orders: {
    path: "orders",
    ops: ["list", "get", "create", "update"],
    description:
      "Orders (filters: CustomerID, DateFrom/To, DateConfirmedFrom/To, DateCompletedFrom/To, ReceivedIssued, Year, Number, AnalyticsID, Reference, Status)",
  },
  outbox: {
    path: "outbox",
    ops: ["list", "get"],
    description:
      "Outbox / sent e-documents, read-only (filters: OutboxType, OutboxImportStatus, OutboxDateFrom/To)",
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
    ops: ["list", "get", "create", "update"],
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
    ops: ["list", "get", "create", "update"],
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
    ops: ["list", "get", "create", "update"],
    description:
      "Stock entries / inventory receipts and issues (filters: StockEntryType, StockEntrySubtype, Status, AnalyticId, DateFrom/To)",
  },
  stocks: {
    path: "stocks",
    ops: ["list", "get"],
    description:
      "Stock levels, read-only; get by item ID (filters: ItemID, ItemTitle, ItemIdentifier, ItemEANCode, ItemType, WarehouseId, BatchNumber, Date, ResultsByBatchNumber)",
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
    ops: ["list", "get", "create", "update"],
    description: "Warehouses",
  },
};

type AttachmentOp = "list" | "get" | "add" | "update";

interface AttachmentDef {
  /** Attachment collection path under /api/orgs/{organisationId}/. */
  path: string;
  /** Override path for the add operation (inbox posts to the record itself). */
  addPath?: string;
  /** What {parentId} refers to. */
  parent: string;
  ops: readonly AttachmentOp[];
  /**
   * JSON body shape for uploads:
   *  - "attachment": { AttachmentData, AttachmentFileName, AttachmentMimeType }
   *  - "documentAttachment": { AttachmentData, FileName, MimeType, Description }
   *  - "attachmentList": array of "attachment" objects (inbox)
   */
  body: "attachment" | "documentAttachment" | "attachmentList";
}

/** Resources with attachment endpoints. Uploads are JSON with base64 data. */
const ATTACHMENTS: Record<string, AttachmentDef> = {
  documents: {
    path: "documents/{parentId}/attachments",
    parent: "document ID",
    ops: ["get", "add", "update"],
    body: "documentAttachment",
  },
  inbox: {
    path: "inbox/{parentId}/attachments",
    addPath: "inbox/{parentId}",
    parent: "inbox record ID",
    ops: ["add"],
    body: "attachmentList",
  },
  issuedInvoices: {
    path: "issuedinvoices/{parentId}/attachments",
    parent: "issued invoice ID",
    ops: ["list", "add"],
    body: "attachment",
  },
  receivedInvoices: {
    path: "receivedinvoices/{parentId}/attachments",
    parent: "received invoice ID",
    ops: ["list", "add"],
    body: "attachment",
  },
};

interface ActionDef {
  /** Record collection path under /api/orgs/{organisationId}/. */
  path: string;
  /** Actions performed via PUT. */
  actions: readonly string[];
  /** Actions performed via GET (e.g. PDF downloads). */
  getActions?: readonly string[];
  /** Whether the endpoint requires the record's RowVersion (query param). */
  rowVersion: boolean;
  /** Extra query params some actions accept. */
  extraParams?: string;
}

/**
 * Resources with custom-action endpoints. Issued invoices are handled by the
 * dedicated perform_issued_invoice_action tool.
 */
const ACTIONS: Record<string, ActionDef> = {
  inbox: {
    path: "inbox",
    actions: ["approve", "reject", "createReceivedInvoice"],
    rowVersion: false,
    extraParams: "approvalReason (approve), rejectionReason (reject)",
  },
  issuedInvoicePostings: {
    path: "issuedinvoicepostings",
    actions: ["issue", "issueCancellation"],
    rowVersion: false,
  },
  orders: {
    path: "orders",
    actions: [
      "confirm",
      "cancelConfirmation",
      "complete",
      "cancelCompletion",
      "invalidate",
      "cancelInvalidation",
      "createissuedinvoice",
      "generatepdf",
    ],
    getActions: ["getorderpdf"],
    rowVersion: true,
  },
  stockEntries: {
    path: "stockentry",
    actions: ["confirm", "cancelConfirmation"],
    rowVersion: true,
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

  const attachmentNames = Object.keys(ATTACHMENTS) as [string, ...string[]];

  const attachmentResourceParam = z
    .enum(attachmentNames)
    .describe("The resource whose attachments to operate on");

  const attachmentCatalog = (op: AttachmentOp): string =>
    Object.entries(ATTACHMENTS)
      .filter(([, def]) => def.ops.includes(op))
      .map(([name, def]) => `${name} (parentId = ${def.parent})`)
      .join("; ");

  /** Resolve the attachment endpoint, checking the op and substituting {parentId}. */
  const attachmentPath = (
    resource: string,
    organisationId: string,
    parentId: string,
    op: AttachmentOp,
  ): string => {
    const def = ATTACHMENTS[resource];
    if (!def.ops.includes(op)) {
      throw new Error(
        `Attachments of '${resource}' do not support '${op}'. Supported operations: ${def.ops.join(", ")}.`,
      );
    }
    const path = op === "add" && def.addPath !== undefined ? def.addPath : def.path;
    return `/api/orgs/${organisationId}/${path.replace("{parentId}", encodeURIComponent(parentId))}`;
  };

  server.tool(
    "minimax_list_attachments",
    `List attachments of a record. Resources: ${attachmentCatalog("list")}`,
    {
      resource: attachmentResourceParam,
      organisationId: z.string().describe("The organization ID"),
      parentId: z.string().describe("ID of the record whose attachments to list"),
    },
    guard(async ({ resource, organisationId, parentId }) =>
      ok(
        `${String(resource)} attachments`,
        await api.callApi(
          "GET",
          attachmentPath(resource as string, organisationId as string, parentId as string, "list"),
        ),
      ),
    ),
  );

  server.tool(
    "minimax_get_attachment",
    `Get a single attachment of a record, including its base64 data. Resources: ${attachmentCatalog("get")}`,
    {
      resource: attachmentResourceParam,
      organisationId: z.string().describe("The organization ID"),
      parentId: z.string().describe("ID of the record the attachment belongs to"),
      attachmentId: z.string().describe("The attachment ID"),
    },
    guard(async ({ resource, organisationId, parentId, attachmentId }) =>
      ok(
        `${String(resource)} attachment`,
        await api.callApi(
          "GET",
          `${attachmentPath(resource as string, organisationId as string, parentId as string, "get")}/${encodeURIComponent(attachmentId as string)}`,
        ),
      ),
    ),
  );

  server.tool(
    "minimax_add_attachment",
    `Upload a file as an attachment to a record. Resources: ${attachmentCatalog("add")}`,
    {
      resource: attachmentResourceParam,
      organisationId: z.string().describe("The organization ID"),
      parentId: z.string().describe("ID of the record to attach the file to"),
      fileData: z.string().describe("Base64 encoded file data"),
      fileName: z.string().describe("The file name"),
      contentType: z
        .string()
        .optional()
        .describe("MIME type of the file (default application/pdf)"),
      description: z
        .string()
        .optional()
        .describe("Attachment description (documents only)"),
    },
    guard(async ({ resource, organisationId, parentId, fileData, fileName, contentType, description }) => {
      const def = ATTACHMENTS[resource as string];
      const mime = (contentType as string) || "application/pdf";
      const attachment = { AttachmentData: fileData, AttachmentFileName: fileName, AttachmentMimeType: mime };
      const body =
        def.body === "documentAttachment"
          ? { AttachmentData: fileData, FileName: fileName, MimeType: mime, Description: description }
          : def.body === "attachmentList"
            ? [attachment]
            : attachment;
      return ok(
        `${String(resource)} attachment added`,
        await api.callApi(
          "POST",
          attachmentPath(resource as string, organisationId as string, parentId as string, "add"),
          body,
        ),
      );
    }),
  );

  server.tool(
    "minimax_update_attachment",
    `Update an attachment of a record. Fetch it with minimax_get_attachment first and send back the full object including its RowVersion. Resources: ${attachmentCatalog("update")}`,
    {
      resource: attachmentResourceParam,
      organisationId: z.string().describe("The organization ID"),
      parentId: z.string().describe("ID of the record the attachment belongs to"),
      attachmentId: z.string().describe("The attachment ID"),
      payload: z
        .record(z.unknown())
        .describe("The full updated attachment, including the current RowVersion"),
    },
    guard(async ({ resource, organisationId, parentId, attachmentId, payload }) =>
      ok(
        `${String(resource)} attachment updated`,
        await api.callApi(
          "PUT",
          `${attachmentPath(resource as string, organisationId as string, parentId as string, "update")}/${encodeURIComponent(attachmentId as string)}`,
          payload,
        ),
      ),
    ),
  );

  const actionNames = Object.keys(ACTIONS) as [string, ...string[]];

  const actionCatalog = Object.entries(ACTIONS)
    .map(([name, def]) => {
      const all = [...def.actions, ...(def.getActions ?? [])];
      const extra = def.extraParams ? `; params: ${def.extraParams}` : "";
      const rv = def.rowVersion ? "; requires rowVersion" : "";
      return `${name}: ${all.join(", ")}${rv}${extra}`;
    })
    .join(" | ");

  server.tool(
    "minimax_action",
    `Perform a custom action on a record (confirm/complete/invalidate an order, confirm a stock entry, approve/reject an inbox document or turn it into a received invoice, issue an invoice posting, generate PDFs). Where rowVersion is required it comes from the record's RowVersion field (fetch with minimax_get). Actions per resource: ${actionCatalog}. For issued invoices use perform_issued_invoice_action.`,
    {
      resource: z.enum(actionNames).describe("The resource to act on"),
      organisationId: z.string().describe("The organization ID"),
      id: z.string().describe("Record ID"),
      actionName: z.string().describe("The action to perform (see tool description)"),
      rowVersion: z
        .string()
        .optional()
        .describe("RowVersion concurrency token (required for orders and stockEntries)"),
      params: z
        .record(z.union([z.string(), z.number()]))
        .optional()
        .describe("Extra query parameters, e.g. { rejectionReason: '...' }"),
    },
    guard(async ({ resource, organisationId, id, actionName, rowVersion, params }) => {
      const def = ACTIONS[resource as string];
      const action = actionName as string;
      const isGet = def.getActions?.includes(action) ?? false;
      if (!isGet && !def.actions.includes(action)) {
        return fail(
          `Unknown action '${action}' for '${String(resource)}'. Available: ${[...def.actions, ...(def.getActions ?? [])].join(", ")}.`,
        );
      }
      if (def.rowVersion && !rowVersion) {
        return fail(`Action '${action}' on '${String(resource)}' requires rowVersion.`);
      }
      const endpoint =
        `/api/orgs/${organisationId}/${def.path}/${encodeURIComponent(id as string)}/actions/${encodeURIComponent(action)}` +
        query({ rowVersion, ...(params as Record<string, unknown> | undefined) });
      return ok(
        `${String(resource)} action result`,
        await api.callApi(isGet ? "GET" : "PUT", endpoint),
      );
    }),
  );

  server.tool(
    "get_current_user_profile",
    "Get the profile of the current API user - API docs: https://moj.minimax.si/SI/API/Help/Api/GET-api-currentuser-profile",
    {},
    guard(async () => ok("Current user profile", await api.callApi("GET", "/api/currentuser/profile"))),
  );
}
