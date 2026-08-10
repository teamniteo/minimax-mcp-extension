# Minimax (SI) Accounting MCP — Desktop Extension

A [Model Context Protocol](https://modelcontextprotocol.io) server for the
**Minimax Slovenian accounting API** (`moj.minimax.si`), packaged as a portable
desktop extension (`.mcpb` / `.dxt`), bundled so it installs into Claude Desktop
with two clicks and no manual JSON editing.

## What you get

Tools (read + attachment upload):

| Tool | Endpoint |
|------|----------|
| `list_organizations` | `GET /api/currentuser/orgs` |
| `get_organization` | `GET /api/orgs/{id}` |
| `list_customers` | `GET /api/orgs/{id}/customers` |
| `list_items` | `GET /api/orgs/{id}/items` |
| `list_issued_invoices` | `GET /api/orgs/{id}/issuedinvoices` |
| `list_received_invoices` | `GET /api/orgs/{id}/receivedinvoices` |
| `get_vatrates` | `GET /api/orgs/{id}/vatrates` |
| `get_currency_by_code` | `GET /api/orgs/{id}/currencies/code(CODE)` |
| `get_country_by_code` | `GET /api/orgs/{id}/countries/code(CODE)` |
| `get_report_templates` | `GET /api/orgs/{id}/report-templates` |
| `get_analytics` | `GET /api/orgs/{id}/analytics` |
| `get_received_invoice_attachments` | `GET .../receivedinvoices/{id}/attachments` |
| `add_received_invoice_attachment` | `POST .../receivedinvoices/{id}/attachments` |
| `create_issued_invoice` | `POST /api/orgs/{id}/issuedinvoices` |
| `create_received_invoice` | `POST /api/orgs/{id}/receivedinvoices` |
| `perform_issued_invoice_action` | `PUT .../issuedinvoices/{id}/actions/{action}_{rowVersion}` |
| `create_customer` | `POST /api/orgs/{id}/customers` |
| `add_customer_by_tax_number` | `POST /api/orgs/{id}/customers/addbytaxnumber(TAX)` |
| `create_item` | `POST /api/orgs/{id}/items` |
| `get_current_user_profile` | `GET /api/currentuser/profile` |

Generic CRUD tools covering the full API surface (35 modules — accounts,
addresses, analytics, bank accounts, contacts, countries, currencies,
customers, dashboards, document numbering, documents, employees, exchange
rates, inbox, invoice postings, invoices, items, journal types, journals,
orders, outbox, payment methods, postal codes, product groups, purpose codes,
report templates, stock, stock entries, VAT accounting types, VAT rates,
warehouses):

| Tool | Endpoint |
|------|----------|
| `minimax_list` | `GET /api/orgs/{id}/{resource}` |
| `minimax_get` | `GET /api/orgs/{id}/{resource}/{recordId}` or `/code(CODE)` |
| `minimax_create` | `POST /api/orgs/{id}/{resource}` |
| `minimax_update` | `PUT /api/orgs/{id}/{resource}/{recordId}` |
| `minimax_delete` | `DELETE /api/orgs/{id}/{resource}/{recordId}` |

`minimax_action` performs custom actions on records
(`PUT/GET .../{resource}/{recordId}/actions/{action}?rowVersion=...`):

| Resource | Actions |
|----------|---------|
| `orders` | `confirm`, `cancelConfirmation`, `complete`, `cancelCompletion`, `invalidate`, `cancelInvalidation`, `createissuedinvoice`, `generatepdf`, `getorderpdf` |
| `stockEntries` | `confirm`, `cancelConfirmation` |
| `inbox` | `approve`, `reject`, `createReceivedInvoice` |
| `issuedInvoicePostings` | `issue`, `issueCancellation` |

Issued-invoice actions (`issue`, `issueAndGeneratepdf`, ...) stay on the
dedicated `perform_issued_invoice_action` tool.

Attachment tools (uploads are JSON with base64 `AttachmentData`):

| Tool | Resources |
|------|-----------|
| `minimax_list_attachments` | `issuedInvoices`, `receivedInvoices` |
| `minimax_get_attachment` | `documents` (returns base64 data) |
| `minimax_add_attachment` | `documents`, `inbox`, `issuedInvoices`, `receivedInvoices` |
| `minimax_update_attachment` | `documents` |
| `minimax_delete_attachment` | `documents`, `inbox` |

Each generic tool takes a `resource` name (e.g. `customers`, `orders`,
`journals`); nested resources (customer `addresses`, `bankAccounts`,
`contacts`, journal `journalVats`) also take a `parentId`. Updates require the
record's current `RowVersion` — fetch it with `minimax_get` first. Resource
registry and per-resource operations live in `src/crud.ts`.

Prompts (guided workflows):

| Prompt | What it does |
|--------|--------------|
| `create-invoice-workflow` | Create, issue and generate a PDF for an invoice, end to end |
| `recurring-monthly-invoice` | Create and issue this month's recurring invoice for a customer, then PDF |
| `revenue-summary` | Summarise issued invoices for a year with totals by customer and status |
| `customer-invoice-history` | Find a customer and list their invoices with paid/unpaid breakdown |
| `enter-received-invoice` | Record a supplier (received) invoice |
| `unpaid-invoices` | List unpaid and overdue issued invoices |

### Creating an invoice

`create_issued_invoice` takes an `invoice` object that mirrors the Minimax
`IssuedInvoice` model. References (customer, item, VAT rate, currency) are given
by ID — discover them with `list_customers`, `list_items`, `get_vatrates`. A
minimal draft:

```jsonc
{
  "organisationId": "123456",
  "invoice": {
    "Customer": { "ID": 987 },
    "DateIssued": "2026-07-05",
    "DateDue": "2026-07-19",
    "PricesOnInvoice": "N",
    "Status": "O",
    "IssuedInvoiceReportTemplate": { "ID": 42 },
    "IssuedInvoiceRows": [
      { "ItemName": "Konverter 1000", "Quantity": 1, "Price": 50.0, "VATPercent": 22 }
    ]
  }
}
```

Then issue it and get the PDF (base64 in the response):

```jsonc
{ "organisationId": "123456", "issuedInvoiceId": "555",
  "actionName": "issueAndGeneratepdf", "rowVersion": "<from create response>" }
```

`create_received_invoice` works the same way against the `ReceivedInvoice`
model (supplier referenced via `Customer`, `Status` `O`/`P`/`Z`).

Both create tools accept any additional Minimax fields (the `invoice` object is
pass-through), so you are not limited to the fields listed above.

## Install

1. Download `minimax-mcp-server.mcpb`.
2. In Claude Desktop: **Settings → Extensions → Install Extension** and pick the
   `.mcpb` file (or double-click it).
3. Enter your Minimax credentials in the extension settings:
   - **Developer ID** / **Developer Password** — your app (client) credentials
   - **Organization Username** / **Organization Password** — the API login you
     defined in your Minimax user account
4. The base URL, token URL and scope have sensible defaults; change only if you
   use a different Minimax region.

Credentials are stored by Claude Desktop and passed to the server as environment
variables. Nothing is hardcoded in the bundle.

## Authentication

OAuth2 **password grant** against `https://moj.minimax.si/si/aut/oauth20/token`:

- `client_id` = Developer ID, `client_secret` = Developer Password
- `username` = Organization Username, `password` = Organization Password
- `scope` = `minimax.si`

The token is cached (in memory and in a `0600` temp file) and refreshed
automatically five minutes before expiry.

## Build from source

Requires Node.js 18+.

```bash
npm install
npm run build      # tsc type-check + esbuild single-file bundle -> build/index.js
npm start          # run locally (expects MINIMAX_* env vars)
```

Repackage the `.mcpb`:

```bash
npx @anthropic-ai/mcpb pack . minimax-mcp-server.mcpb
```

Publishing a GitHub release builds and attaches the `.mcpb` automatically.

## License

MIT
