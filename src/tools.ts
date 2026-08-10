import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient, ApiResponse } from "./apiClient.js";

/**
 * Minimax "mMApiFkField" — a foreign-key reference to another record.
 * Only ID is needed on create; Name is optional and ignored by the API.
 */
const fkField = z
  .object({
    ID: z.number().describe("Record ID of the referenced entity"),
    Name: z.string().optional().describe("Optional display name (ignored on create)"),
  })
  .describe("Reference to a related record by ID");

/** A single issued-invoice line (IssuedInvoiceRow). Extra fields are allowed. */
const issuedInvoiceRow = z
  .object({
    Item: fkField.optional().describe("Existing item reference (use list_items to find the ID). Note: if you don't set ItemName, Minimax prints the referenced item's own name as the line label."),
    ItemName: z.string().optional().describe("The line label printed on the invoice. Set this to show custom text (e.g. 'Konverter 1000') instead of the referenced item's name."),
    Description: z.string().optional().describe("Line description. If ItemName is empty, this text is promoted to the line label automatically."),
    Quantity: z.number().optional().describe("Quantity"),
    UnitOfMeasurement: z.string().optional().describe("Unit of measure, e.g. 'kos', 'h'"),
    Price: z.number().optional().describe("Unit price without VAT"),
    PriceWithVAT: z.number().optional().describe("Unit price including VAT"),
    VATPercent: z.number().optional().describe("VAT percent, e.g. 22"),
    VatRate: fkField.optional().describe("VAT rate reference (use get_vatrates to find the ID)"),
    DiscountPercent: z.number().optional().describe("Discount percent for the row"),
  })
  .passthrough();

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

function ok(label: string, resp: ApiResponse): ToolResult {
  const body =
    typeof resp.body === "string"
      ? resp.body
      : JSON.stringify(resp.body, null, 2);
  // Surface the new resource ID (from the Location header) so the caller does
  // not need a follow-up list request after a create.
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

/** Wrap a handler so thrown errors become MCP tool errors instead of crashes. */
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

/** Build a querystring from the provided key/value pairs, skipping undefined. */
function query(pairs: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(pairs)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function registerTools(server: McpServer, api: ApiClient): void {
  const DOCS = "https://moj.minimax.si/SI/API/Help/Api";

  server.tool(
    "list_organizations",
    `List all organizations for the current user (paged) - API docs: ${DOCS}/GET-api-currentuser-orgs`,
    {
      searchString: z.string().optional().describe("Search across predefined fields (optional)"),
      currentPage: z.number().optional().describe("Current page index starting with 1 (optional)"),
      pageSize: z.number().optional().describe("Number of records returned per page (optional)"),
      sortField: z.string().optional().describe("Field name to sort by (optional)"),
      order: z.enum(["A", "D"]).optional().describe("Sort order: A = ascending, D = descending (optional)"),
    },
    guard(async ({ searchString, currentPage, pageSize, sortField, order }) =>
      ok(
        "Organizations",
        await api.callApi(
          "GET",
          `/api/currentuser/orgs${query({ SearchString: searchString, CurrentPage: currentPage, PageSize: pageSize, SortField: sortField, Order: order })}`,
        ),
      ),
    ),
  );

  server.tool(
    "get_organization",
    `Get organization details - API docs: ${DOCS}/GET-api-orgs-organisationId`,
    { organisationId: z.string().describe("The organization ID") },
    guard(async ({ organisationId }) =>
      ok("Organization details", await api.callApi("GET", `/api/orgs/${organisationId}`)),
    ),
  );

  server.tool(
    "list_customers",
    `List all customers for an organization - API docs: ${DOCS}/GET-api-orgs-organisationId-customers`,
    {
      organisationId: z.string().describe("The organization ID"),
      currentPage: z.number().optional().describe("Current page index starting with 1 (optional)"),
      pageSize: z.number().optional().describe("Number of records returned per page (optional)"),
    },
    guard(async ({ organisationId, currentPage, pageSize }) =>
      ok(
        "Customers",
        await api.callApi(
          "GET",
          `/api/orgs/${organisationId}/customers${query({ CurrentPage: currentPage, PageSize: pageSize })}`,
        ),
      ),
    ),
  );

  server.tool(
    "list_items",
    `List all items for an organization - API docs: ${DOCS}/GET-api-orgs-organisationId-items`,
    {
      organisationId: z.string().describe("The organization ID"),
      currentPage: z.number().optional().describe("Current page index starting with 1 (optional)"),
      pageSize: z.number().optional().describe("Number of records returned per page (optional)"),
    },
    guard(async ({ organisationId, currentPage, pageSize }) =>
      ok(
        "Items",
        await api.callApi(
          "GET",
          `/api/orgs/${organisationId}/items${query({ CurrentPage: currentPage, PageSize: pageSize })}`,
        ),
      ),
    ),
  );

  server.tool(
    "list_issued_invoices",
    `List all issued invoices for an organization - API docs: ${DOCS}/GET-api-orgs-organisationId-issuedinvoices`,
    {
      organisationId: z.string().describe("The organization ID"),
      year: z.number().optional().describe("Filter invoices by year (optional)"),
      status: z.string().optional().describe("Filter invoices by status (e.g., Statuspayment) (optional)"),
      currentPage: z.number().optional().describe("Current page index starting with 1 (optional)"),
      pageSize: z.number().optional().describe("Number of records returned per page (optional)"),
    },
    guard(async ({ organisationId, year, status, currentPage, pageSize }) =>
      ok(
        "Issued invoices",
        await api.callApi(
          "GET",
          `/api/orgs/${organisationId}/issuedinvoices${query({ year, status, CurrentPage: currentPage, PageSize: pageSize })}`,
        ),
      ),
    ),
  );

  server.tool(
    "list_received_invoices",
    `List all received invoices for an organization - API docs: ${DOCS}/GET-api-orgs-organisationId-receivedinvoices`,
    {
      organisationId: z.string().describe("The organization ID"),
      year: z.number().optional().describe("Filter invoices by year (optional)"),
      statuses: z.string().optional().describe("Filter invoices by statuses (optional)"),
      customer: z.string().optional().describe("Filter invoices by customer (optional)"),
      currentPage: z.number().optional().describe("Current page index starting with 1 (optional)"),
      pageSize: z.number().optional().describe("Number of records returned per page (optional)"),
    },
    guard(async ({ organisationId, year, statuses, customer, currentPage, pageSize }) =>
      ok(
        "Received invoices",
        await api.callApi(
          "GET",
          `/api/orgs/${organisationId}/receivedinvoices${query({ year, statuses, customer, CurrentPage: currentPage, PageSize: pageSize })}`,
        ),
      ),
    ),
  );

  server.tool(
    "get_vatrates",
    `Get VAT rates for an organization - API docs: ${DOCS}/GET-api-orgs-organisationId-vatrates`,
    {
      organisationId: z.string().describe("The organization ID"),
      vatRateCode: z.string().optional().describe("VAT rate code (optional)"),
      date: z.string().optional().describe("Date for VAT rate lookup (YYYY-MM-DD format, optional)"),
    },
    guard(async ({ organisationId, vatRateCode, date }) => {
      let endpoint = `/api/orgs/${organisationId}/vatrates`;
      if (vatRateCode !== undefined && vatRateCode !== "") {
        endpoint = `/api/orgs/${organisationId}/vatrates/code(${vatRateCode})`;
        if (date !== undefined && date !== "") {
          endpoint += `?date=${date}`;
        }
      }
      return ok("VAT rates", await api.callApi("GET", endpoint));
    }),
  );

  server.tool(
    "get_currency_by_code",
    `Get currency details by currency code - API docs: ${DOCS}/GET-api-orgs-organisationId-currencies-code-currencyCode`,
    {
      organisationId: z.string().describe("The organization ID"),
      currencyCode: z.string().describe("Currency code (e.g., EUR, USD)"),
    },
    guard(async ({ organisationId, currencyCode }) =>
      ok(
        "Currency",
        await api.callApi("GET", `/api/orgs/${organisationId}/currencies/code(${currencyCode})`),
      ),
    ),
  );

  server.tool(
    "get_country_by_code",
    `Get country details by country code - API docs: ${DOCS}/GET-api-orgs-organisationId-countries-code-countryCode`,
    {
      organisationId: z.string().describe("The organization ID"),
      countryCode: z.string().describe("Country code (e.g., SI, HR)"),
    },
    guard(async ({ organisationId, countryCode }) =>
      ok(
        "Country",
        await api.callApi("GET", `/api/orgs/${organisationId}/countries/code(${countryCode})`),
      ),
    ),
  );

  server.tool(
    "get_report_templates",
    `Get report templates for an organization - API docs: ${DOCS}/GET-api-orgs-organisationId-report-templates`,
    {
      organisationId: z.string().describe("The organization ID"),
      searchString: z.string().optional().describe("Search string to filter templates (optional)"),
      pageSize: z.number().optional().describe("Number of results per page (optional, default 100)"),
    },
    guard(async ({ organisationId, searchString, pageSize }) =>
      ok(
        "Report templates",
        await api.callApi(
          "GET",
          `/api/orgs/${organisationId}/report-templates${query({ SearchString: searchString, PageSize: pageSize ?? 100 })}`,
        ),
      ),
    ),
  );

  server.tool(
    "get_analytics",
    `Get analytics data for an organization - API docs: ${DOCS}/GET-api-orgs-organisationId-analytics`,
    { organisationId: z.string().describe("The organization ID") },
    guard(async ({ organisationId }) =>
      ok("Analytics", await api.callApi("GET", `/api/orgs/${organisationId}/analytics`)),
    ),
  );

  server.tool(
    "get_received_invoice_attachments",
    `Get all attachments for a received invoice - API docs: ${DOCS}/GET-api-orgs-organisationId-receivedinvoices-receivedInvoiceId-attachments`,
    {
      organisationId: z.string().describe("The organization ID"),
      receivedInvoiceId: z.string().describe("The received invoice ID"),
    },
    guard(async ({ organisationId, receivedInvoiceId }) =>
      ok(
        "Received invoice attachments",
        await api.callApi(
          "GET",
          `/api/orgs/${organisationId}/receivedinvoices/${receivedInvoiceId}/attachments`,
        ),
      ),
    ),
  );

  server.tool(
    "add_received_invoice_attachment",
    `Add a new attachment to a received invoice - API docs: ${DOCS}/POST-api-orgs-organisationId-receivedinvoices-receivedInvoiceId-attachments`,
    {
      organisationId: z.string().describe("The organization ID"),
      receivedInvoiceId: z.string().describe("The received invoice ID"),
      fileData: z.string().describe("Base64 encoded file data"),
      fileName: z.string().describe("The file name"),
      contentType: z.string().optional().describe("MIME type of the file (default application/pdf)"),
    },
    guard(async ({ organisationId, receivedInvoiceId, fileData, fileName, contentType }) =>
      ok(
        "Received invoice attachment added",
        await api.callApi(
          "POST",
          `/api/orgs/${organisationId}/receivedinvoices/${receivedInvoiceId}/attachments`,
          {
            AttachmentData: fileData,
            AttachmentFileName: fileName,
            AttachmentMimeType: (contentType as string) || "application/pdf",
          },
        ),
      ),
    ),
  );

  // ---- Write tools -------------------------------------------------------

  server.tool(
    "create_issued_invoice",
    `Create a new issued invoice (draft by default). Reference existing Customer/Item/VatRate by ID (discover them with list_customers, list_items, get_vatrates). Set Status "O" for draft or "I" for issued. To issue a draft and produce a PDF afterwards, call perform_issued_invoice_action with the returned IssuedInvoiceId and RowVersion. API docs: ${DOCS}/POST-api-orgs-organisationId-issuedinvoices`,
    {
      organisationId: z.string().describe("The organization ID"),
      invoice: z
        .object({
          Customer: fkField.describe("Customer reference by ID (required)"),
          InvoiceType: z
            .enum(["R", "P"])
            .optional()
            .describe("R = issued invoice (default), P = proforma invoice"),
          DateIssued: z.string().optional().describe("Invoice date, e.g. 2026-07-05"),
          DateTransaction: z.string().optional().describe("Date of transaction/supply"),
          DateDue: z.string().optional().describe("Due date"),
          Currency: fkField.optional().describe("Currency reference (e.g. EUR); defaults to home currency"),
          PricesOnInvoice: z
            .enum(["D", "N"])
            .optional()
            .describe("D = VAT included in price, N = VAT added to price"),
          Status: z.enum(["O", "I"]).optional().describe("O = Draft (default), I = Issued"),
          IssuedInvoiceReportTemplate: fkField
            .optional()
            .describe("Report template for the invoice (code IR); use get_report_templates"),
          DeliveryNoteReportTemplate: fkField
            .optional()
            .describe("Report template for the delivery note (code DO)"),
          DescriptionAbove: z.string().optional().describe("Text shown above the invoice lines"),
          DescriptionBelow: z.string().optional().describe("Text shown below the invoice lines"),
          Notes: z.string().optional().describe("Internal notes"),
          IssuedInvoiceRows: z
            .array(issuedInvoiceRow)
            .optional()
            .describe("Invoice line items"),
        })
        .passthrough()
        .describe("IssuedInvoice payload. Any additional Minimax fields may be included."),
    },
    guard(async ({ organisationId, invoice }) => {
      // Normalise the payload so common calls succeed on the first attempt:
      //  - default InvoiceType to "R" (issued invoice), avoiding a 409
      //  - promote a row's custom text to ItemName, which is the label printed
      //    on the invoice. When only an Item reference is given, Minimax prints
      //    the item's own name (e.g. "Svetovanje"); setting ItemName overrides it.
      const inv: Record<string, unknown> = {
        InvoiceType: "R",
        ...(invoice as Record<string, unknown>),
      };
      const rows = inv.IssuedInvoiceRows;
      if (Array.isArray(rows)) {
        inv.IssuedInvoiceRows = rows.map((r) => {
          const row = { ...(r as Record<string, unknown>) };
          if (!row.ItemName && typeof row.Description === "string" && row.Description) {
            row.ItemName = row.Description;
            delete row.Description;
          }
          return row;
        });
      }
      return ok(
        "Issued invoice created",
        await api.callApi("POST", `/api/orgs/${organisationId}/issuedinvoices`, inv),
      );
    }),
  );

  server.tool(
    "create_received_invoice",
    `Create a new received (supplier) invoice. Reference the supplier via Customer by ID (list_customers). Set Status "O" for draft, "P" for confirmed, or "Z" for rejected. API docs: ${DOCS}/POST-api-orgs-organisationId-receivedinvoices`,
    {
      organisationId: z.string().describe("The organization ID"),
      invoice: z
        .object({
          Customer: fkField.describe("Supplier reference by ID (required)"),
          DateIssued: z.string().optional().describe("Invoice date, e.g. 2026-07-05"),
          DateTransaction: z.string().optional().describe("Date of transaction/supply"),
          DateDue: z.string().optional().describe("Due date"),
          DateReceived: z.string().optional().describe("Date the invoice was received"),
          InvoiceAmount: z.number().optional().describe("Total invoice amount"),
          Currency: fkField.optional().describe("Currency reference; defaults to home currency"),
          Status: z.enum(["O", "P", "Z"]).optional().describe("O = Draft, P = Confirmed, Z = Rejected"),
          DocumentReference: z.string().optional().describe("Supplier document reference / number"),
          PaymentReferenceType: z.enum(["SI", "RF"]).optional().describe("Payment reference type"),
          PaymentReferenceModel: z.string().optional().describe("Payment reference model, e.g. SI00"),
          PaymentReferenceNumber: z.string().optional().describe("Payment reference number"),
          PaymentType: z
            .enum(["D", "N", "Z", "P", "R", "B"])
            .optional()
            .describe("D=Payment order, N=No payment order, Z=Private undertaking, P=Employee, R=Another account, B=Cash book"),
          Notes: z.string().optional().describe("Notes"),
        })
        .passthrough()
        .describe("ReceivedInvoice payload. Any additional Minimax fields may be included."),
    },
    guard(async ({ organisationId, invoice }) =>
      ok(
        "Received invoice created",
        await api.callApi("POST", `/api/orgs/${organisationId}/receivedinvoices`, invoice),
      ),
    ),
  );

  server.tool(
    "perform_issued_invoice_action",
    `Perform a custom action on an issued invoice (e.g. issue a draft and/or generate its PDF). The rowVersion is required for the concurrency check and comes from the created/fetched invoice's RowVersion field. For 'issueAndGeneratepdf' the response contains the PDF as base64. API docs: ${DOCS}/PUT-api-orgs-organisationId-issuedinvoices-issuedInvoiceId-actions-actionName_rowVersion`,
    {
      organisationId: z.string().describe("The organization ID"),
      issuedInvoiceId: z.string().describe("The issued invoice ID (from create_issued_invoice)"),
      actionName: z
        .enum([
          "issue",
          "issueCancellation",
          "generatepdf",
          "copytocreditnote",
          "copyToReverse",
          "issueAndGeneratepdf",
          "sendEInvoice",
        ])
        .describe("The action to perform"),
      rowVersion: z.string().describe("RowVersion of the invoice (concurrency token)"),
      issueCancellationReason: z
        .string()
        .optional()
        .describe("Optional reason, only used with the issueCancellation action"),
    },
    guard(async ({ organisationId, issuedInvoiceId, actionName, rowVersion, issueCancellationReason }) => {
      const endpoint =
        `/api/orgs/${organisationId}/issuedinvoices/${issuedInvoiceId}/actions/${actionName}` +
        query({ rowVersion, issueCancellationReason });
      return ok("Issued invoice action result", await api.callApi("PUT", endpoint));
    }),
  );

  server.tool(
    "create_customer",
    `Create a new customer (buyer or supplier). Only Name is required. Reference Country/Currency by ID. API docs: ${DOCS}/POST-api-orgs-organisationId-customers`,
    {
      organisationId: z.string().describe("The organization ID"),
      customer: z
        .object({
          Name: z.string().describe("Customer name (required)"),
          Code: z.string().optional().describe("Customer code, unique within the organisation"),
          Address: z.string().optional().describe("Street address"),
          PostalCode: z.string().optional().describe("Postal code"),
          City: z.string().optional().describe("City"),
          Country: fkField.optional().describe("Country reference by ID (use get_country_by_code)"),
          CountryName: z.string().optional().describe("Country name (alternative to Country ref)"),
          TaxNumber: z.string().optional().describe("Tax number (davčna številka)"),
          RegistrationNumber: z.string().optional().describe("Registration number (matična številka)"),
          VATIdentificationNumber: z.string().optional().describe("VAT ID, e.g. SI12345678"),
          SubjectToVAT: z
            .enum(["D", "M", "N"])
            .optional()
            .describe("D = VAT-liable legal person, M = legal person not subject to VAT, N = end user"),
          Currency: fkField.optional().describe("Default currency reference"),
          ExpirationDays: z.number().optional().describe("Default invoice due days"),
          WebSiteURL: z.string().optional().describe("Website URL"),
        })
        .passthrough()
        .describe("Customer payload. Any additional Minimax fields may be included."),
    },
    guard(async ({ organisationId, customer }) =>
      ok(
        "Customer created",
        await api.callApi("POST", `/api/orgs/${organisationId}/customers`, customer),
      ),
    ),
  );

  server.tool(
    "add_customer_by_tax_number",
    `Create a new customer from just a tax number; Minimax fills in the company data from the business registry. API docs: ${DOCS}/POST-api-orgs-organisationId-customers-addbytaxnumber(taxNumber)`,
    {
      organisationId: z.string().describe("The organization ID"),
      taxNumber: z.string().describe("The customer's tax number (davčna številka), e.g. 12345678 or SI12345678"),
    },
    guard(async ({ organisationId, taxNumber }) =>
      ok(
        "Customer created from tax number",
        await api.callApi(
          "POST",
          `/api/orgs/${organisationId}/customers/addbytaxnumber(${encodeURIComponent(taxNumber as string)})`,
        ),
      ),
    ),
  );

  server.tool(
    "create_item",
    `Create a new item (product or service). Name is required; set ItemType (S = service, B = goods, I = product, ...) and reference VatRate/Currency by ID. API docs: ${DOCS}/POST-api-orgs-organisationId-items`,
    {
      organisationId: z.string().describe("The organization ID"),
      item: z
        .object({
          Name: z.string().describe("Item name (required)"),
          Code: z.string().optional().describe("Item code"),
          EANCode: z.string().optional().describe("EAN barcode"),
          Description: z.string().optional().describe("Item description"),
          ItemType: z
            .enum(["B", "M", "P", "I", "S", "A", "AS"])
            .optional()
            .describe("B=Goods, M=Material, P=Semifinished, I=Product, S=Services, A=Advance, AS=Pre-payment for services"),
          UnitOfMeasurement: z.string().optional().describe("Unit of measure, e.g. 'kos', 'h'"),
          VatRate: fkField.optional().describe("VAT rate reference by ID (use get_vatrates)"),
          Price: z.number().optional().describe("Selling price"),
          Currency: fkField.optional().describe("Selling price currency reference"),
          Usage: z.enum(["D", "N"]).optional().describe("D = in use, N = not in use"),
        })
        .passthrough()
        .describe("Item payload. Any additional Minimax fields may be included."),
    },
    guard(async ({ organisationId, item }) =>
      ok("Item created", await api.callApi("POST", `/api/orgs/${organisationId}/items`, item)),
    ),
  );
}
