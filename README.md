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
3. Enter your Minimax credentials in the extension settings (see
   [Configuration](#configuration) for where to get them).
4. The base URL, token URL and scope have sensible defaults; change only if you
   use a different Minimax region.

Credentials are stored by Claude Desktop and passed to the server as environment
variables. Nothing is hardcoded in the bundle.

## Configuration

The extension needs two pairs of credentials.

### Developer ID / Developer Password (OAuth2 client)

These are the client credentials (`client_id` / `client_secret`) of your API
integration. Minimax does not issue them self-service: you have to ask Minimax
support for them.

1. Register and log in at [moj.minimax.si](https://moj.minimax.si).
2. Click the **Pomoč** (Help) icon → **Oddajte zahtevo po pomoči** (submit a
   support request).
3. Pick your organisation and ask for API client credentials ("podatki za
   odjemalca"), e.g. *"Prosim za ID in geslo odjemalca za dostop do Minimax
   API (lastna integracija)."* Tick **Želim prejeti odgovor
   na elektronsko pošto** to also get the reply by email.
4. Support replies with a client ID and client password — enter them as
   **Developer ID** and **Developer Password**.

See Minimax's [API developer guide](https://help.minimax.si/help/api-navodila-za-razvijalce)
and [how to submit a support request](https://help.minimax.si/help/kako-oddamo-zahtevo-po-pomoci).

### Organization Username / Organization Password (API user)

These you create yourself, no support request needed:

1. Log in to Minimax and open your **user account** (Uporabniški račun).
2. At the bottom, under **Gesla za dostop zunanjih aplikacij**, click
   **Nova aplikacija**.
3. Enter an application name and choose a new username and password — use
   these as **Organization Username** and **Organization Password**.

> Repeated logins with a wrong password lock the application; you then have to
> delete it and create a new one.

For local development, put the same values in `.env` (see `.env.example`).

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
