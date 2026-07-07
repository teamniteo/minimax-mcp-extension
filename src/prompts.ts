import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPrompts(server: McpServer): void {
  server.prompt(
    "create-invoice-workflow",
    "Complete workflow to create, issue and generate PDF for an invoice",
    {
      organization_id: z.string().optional().describe("Organization ID to create invoice for"),
      customer_name: z.string().optional().describe("Customer name for the invoice"),
      item_name: z.string().optional().describe("Item/service name for the invoice"),
    },
    ({ organization_id, customer_name, item_name }) => {
      let text =
        "I need to create, issue and generate a PDF for an invoice. Please help me with this complete workflow:\n\n";
      text += "1. First, call 'list_organizations' to see available organizations";
      if (organization_id) text += ` (focus on organization ID: ${organization_id})`;
      text += "\n2. Get organization details and required lookup data:\n";
      text += "   - Get VAT rates using 'get_vatrates' (look for standard rate 'S')\n";
      text += "   - Get currency details using 'get_currency_by_code' (e.g., EUR)\n";
      text += "   - Get country details using 'get_country_by_code' (e.g., SI, HR)\n";
      text += "   - Get report templates using 'get_report_templates' (look for 'IR' and 'DO' templates)\n";
      text += "3. Find or create the item and customer:\n";
      text += "   - Use 'list_items' to find the item, or 'create_item' to add it";
      if (item_name) text += ` (item name: ${item_name})`;
      text += "\n   - Use 'list_customers' to find the customer, or 'create_customer' to add it";
      if (customer_name) text += ` (customer name: ${customer_name})`;
      text += "\n4. Create the invoice as a draft using 'create_issued_invoice' with:\n";
      text += "   - Customer reference (by ID)\n";
      text += "   - IssuedInvoiceRows (item, quantity, price, VAT rate)\n";
      text += "   - Currency and report template (IR for invoice, DO for delivery note)\n";
      text += "   - Status 'O' (draft)\n";
      text += "5. Note the IssuedInvoiceId and RowVersion from the response\n";
      text += "6. Issue the invoice and generate the PDF using 'perform_issued_invoice_action' with actionName 'issueAndGeneratepdf' (pass the RowVersion)\n";
      text += "7. Extract the PDF data from the response (base64 encoded)\n\n";
      text += "This workflow follows the Minimax API pattern.";

      return {
        description: "Invoice creation workflow",
        messages: [
          {
            role: "user" as const,
            content: { type: "text" as const, text },
          },
        ],
      };
    },
  );

  // Helper to register a simple single-message prompt.
  const simplePrompt = (
    name: string,
    description: string,
    argsSchema: Record<string, z.ZodTypeAny>,
    build: (args: Record<string, string | undefined>) => string,
  ) => {
    server.prompt(name, description, argsSchema, (args) => ({
      description,
      messages: [
        {
          role: "user" as const,
          content: { type: "text" as const, text: build(args as Record<string, string | undefined>) },
        },
      ],
    }));
  };

  simplePrompt(
    "revenue-summary",
    "Summarise issued invoices for an organization and year with totals by customer and status",
    {
      organization_id: z.string().optional().describe("Organization ID"),
      year: z.string().optional().describe("Year, e.g. 2025"),
    },
    ({ organization_id, year }) => {
      const org = organization_id ? ` (organization ID ${organization_id})` : "";
      const yr = year ? ` for ${year}` : "";
      return (
        `Give me a revenue summary of issued invoices${yr}${org}:\n` +
        "1. If needed, call 'list_organizations' to find the organization ID.\n" +
        `2. Call 'list_issued_invoices' with the organisationId${year ? ` and year ${year}` : ""} and pageSize 100 (page through all results if TotalRows exceeds the page size).\n` +
        "3. Sum InvoiceValue across all rows for the grand total, and break it down by year, by customer, and by PaymentStatus (Placan = paid, Neplacan* = unpaid).\n" +
        "4. Present a compact table plus totals; note anything unpaid or overdue."
      );
    },
  );

  simplePrompt(
    "customer-invoice-history",
    "Find a customer and list their issued invoices with a paid/unpaid breakdown",
    {
      organization_id: z.string().optional().describe("Organization ID"),
      customer_name: z.string().optional().describe("Customer name to search for"),
    },
    ({ organization_id, customer_name }) => {
      const org = organization_id ? ` (organization ID ${organization_id})` : "";
      const cust = customer_name ? ` for "${customer_name}"` : "";
      return (
        `Show the invoice history${cust}${org}:\n` +
        "1. If needed, call 'list_organizations' to find the organization ID.\n" +
        "2. Call 'list_customers' (page through results) to find the matching customer and note its CustomerId.\n" +
        "3. Call 'list_issued_invoices' (pageSize 100, page through all) and keep only rows whose Customer.ID matches.\n" +
        "4. List those invoices with date, number, amount and PaymentStatus, and summarise total billed vs. outstanding."
      );
    },
  );

  simplePrompt(
    "recurring-monthly-invoice",
    "Create and issue this month's recurring invoice for a customer, then generate the PDF",
    {
      organization_id: z.string().optional().describe("Organization ID"),
      customer_name: z.string().optional().describe("Customer to bill"),
      item_name: z.string().optional().describe("Item/service to bill"),
      amount: z.string().optional().describe("Net amount (without VAT)"),
    },
    ({ organization_id, customer_name, item_name, amount }) => {
      const org = organization_id ? ` (organization ID ${organization_id})` : "";
      return (
        `Create and issue this month's recurring invoice${org}:\n` +
        "1. Find the organization ID with 'list_organizations' if needed.\n" +
        `2. Find the customer${customer_name ? ` "${customer_name}"` : ""} via 'list_customers' (note CustomerId).\n` +
        `3. Find the item${item_name ? ` "${item_name}"` : ""} via 'list_items', and the standard 22% VAT rate via 'get_vatrates' (code 'S'), and the 'IR' report template via 'get_report_templates'.\n` +
        "4. Call 'create_issued_invoice' with Customer, DateIssued today, a due date ~14 days out, Currency EUR, PricesOnInvoice 'N', Status 'O', the IR report template, and one IssuedInvoiceRow " +
        `(ItemName for the printed label, Quantity 1, Price ${amount ?? "<amount>"}, VatRate 22%). Note the Created ID and RowVersion.\n` +
        "5. Confirm the details with me, then call 'perform_issued_invoice_action' with actionName 'issueAndGeneratepdf' and the RowVersion to issue it and return the PDF (base64)."
      );
    },
  );

  simplePrompt(
    "enter-received-invoice",
    "Record a supplier (received) invoice against an existing supplier",
    {
      organization_id: z.string().optional().describe("Organization ID"),
      supplier_name: z.string().optional().describe("Supplier name"),
      amount: z.string().optional().describe("Invoice amount"),
    },
    ({ organization_id, supplier_name, amount }) => {
      const org = organization_id ? ` (organization ID ${organization_id})` : "";
      return (
        `Record a received (supplier) invoice${org}:\n` +
        "1. Find the organization ID with 'list_organizations' if needed.\n" +
        `2. Find the supplier${supplier_name ? ` "${supplier_name}"` : ""} via 'list_customers' (create it with 'create_customer' if it does not exist yet); note the CustomerId.\n` +
        "3. Call 'create_received_invoice' with Customer, DateIssued, DateReceived, DateDue, Currency EUR, " +
        `InvoiceAmount ${amount ?? "<amount>"}, DocumentReference (supplier's invoice number), and Status 'O' (draft) or 'P' (confirmed).\n` +
        "4. Report the Created ID and confirm the entry."
      );
    },
  );

  simplePrompt(
    "unpaid-invoices",
    "List unpaid and overdue issued invoices for an organization",
    {
      organization_id: z.string().optional().describe("Organization ID"),
    },
    ({ organization_id }) => {
      const org = organization_id ? ` (organization ID ${organization_id})` : "";
      return (
        `List unpaid and overdue issued invoices${org}:\n` +
        "1. Find the organization ID with 'list_organizations' if needed.\n" +
        "2. Call 'list_issued_invoices' (pageSize 100, page through all results).\n" +
        "3. Keep rows whose PaymentStatus starts with 'Neplacan' (unpaid) or 'DelnoPlacan' (partially paid); flag 'NeplacanZapadel' / 'DelnoPlacanZapadel' as overdue.\n" +
        "4. Show them sorted by due date with customer, amount, due date and days overdue, plus the total outstanding."
      );
    },
  );
}
