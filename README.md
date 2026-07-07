# Minimax (SI) Accounting MCP — Desktop Extension

A [Model Context Protocol](https://modelcontextprotocol.io) server for the
**Minimax Slovenian accounting API** (`moj.minimax.si`), packaged as a portable
desktop extension (`.mcpb` / `.dxt`). It is a TypeScript port of the original Go
`rac` server, bundled so it installs into Claude Desktop with two clicks and no
manual JSON editing.

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

Repackage the `.mcpb` (it is a plain zip of `manifest.json` + `build/`):

```bash
zip -r minimax-mcp-server.mcpb manifest.json build README.md
```

## Notes

- Full create coverage: customers (`create_customer`), items (`create_item`),
  issued invoices (`create_issued_invoice`), received invoices
  (`create_received_invoice`), plus issuing/PDF generation via
  `perform_issued_invoice_action`. You can build an invoice end-to-end without
  leaving Claude.
- Do **not** commit real credentials. The original `config.toml` approach stored
  secrets in plaintext; this extension avoids that by using Claude Desktop's
  encrypted settings instead.

## License

MIT
