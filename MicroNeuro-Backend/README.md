# MicroNeuro

MicroNeuro is an AI-powered Outlook assistant. It reads a user's inbox through the Microsoft Graph API, uses Groq (Llama 3.3) to extract meetings, deadlines, and action items into a centralized dashboard, and can create calendar events or send emails directly from natural language prompts. It supports multiple connected Microsoft accounts per user and sends automated deadline alerts.

## REST API backend

The REST API wraps Microsoft Graph services and adds an AI intelligence layer on top:

```text
HTTP REST client
      ↓
Express /api/v1 routes
      ↓
Schema validation + auth middleware (multi-account aware)
      ↓
Microsoft Graph API  ⇄  Groq (extraction + natural-language actions)  ⇄  Prisma / Supabase Postgres
```

The backend is intentionally frontend-free. See [`API.md`](API.md) for every implemented route, request field, response shape, authentication requirement, and error contract.

### Quick start

```bash
cp .env.example .env
# Set AZURE_CLIENT_ID, AZURE_TENANT_ID, SESSION_SECRET, GROQ_API_KEY,
# DATABASE_URL, DIRECT_URL in .env
npm install
npm run db:generate
npm run db:migrate:deploy
npm start
```

The API listens on port `5000` by default. Start Microsoft OAuth with:

```bash
curl -c cookies.txt http://localhost:5000/api/v1/auth/login
```

Open the returned `authorizationUrl` in a browser. The callback stores encrypted access and refresh tokens scoped to the connected Microsoft account; tokens are never returned by the API. Then use the same cookie for REST calls:

```bash
curl -b cookies.txt http://localhost:5000/api/v1/auth/me
curl -b cookies.txt 'http://localhost:5000/api/v1/outlook/messages?folder=inbox&limit=10'
```

Pull your inbox into the dashboard:

```bash
curl -b cookies.txt -X POST http://localhost:5000/api/v1/sync/inbox
curl -b cookies.txt http://localhost:5000/api/v1/dashboard/summary
```

Or just ask it to do something:

```bash
curl -b cookies.txt -X POST http://localhost:5000/api/v1/assistant/prompt \
  -H 'content-type: application/json' \
  -d '{"prompt":"schedule a meeting with sara@example.com tomorrow 3pm to 4pm about the FYP demo"}'
```

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `AZURE_CLIENT_ID` | Yes | Microsoft Entra application/client ID |
| `AZURE_TENANT_ID` | Yes | Entra tenant ID, or `common`/`organizations` as appropriate |
| `AZURE_CLIENT_SECRET` | Yes | Entra application client secret |
| `SESSION_SECRET` | Yes in production | Signs the HTTP-only REST session cookie |
| `DATABASE_URL` | Yes | Prisma runtime queries (Supabase pooled connection) |
| `DIRECT_URL` | Yes | Prisma migrations (Supabase direct connection) |
| `GROQ_API_KEY` | Yes | Groq extraction and assistant-prompt intent parsing |
| `OAUTH_REDIRECT_URI` | Yes when deployed | Registered callback URL; defaults to the request host |
| `PUBLIC_BASE_URL` | Recommended | Public API origin used to build the callback URL and webhook subscriptions |
| `WEBHOOK_CLIENT_STATE` | Only for webhooks | Validates that Graph webhook notifications are legitimate |
| `CORS_ORIGIN` | Recommended | Comma-separated allowed frontend origins |
| `PORT` / `HOST` | No | Listener settings; defaults to `5000` / `0.0.0.0` |
| `API_TOKEN_STORAGE_DIR` | No | Root for per-connected-account encrypted token files |
| `MCP_OUTLOOK_AUTH_MODE` | No | `interactive` or `headless` for the retained MCP process |

### Microsoft Entra and Graph setup

Create an app registration in Microsoft Entra ID, add the REST callback URL under **Web** redirect URIs, and grant delegated Microsoft Graph permissions. The default scope set used by the implementation is:

`User.Read`, `offline_access`, `Mail.Read`, `Mail.ReadWrite`, `Mail.Send`, `Calendars.Read`, `Calendars.ReadWrite`, `Contacts.Read`, `Contacts.ReadWrite`, `Tasks.Read`, `Tasks.ReadWrite`, `MailboxSettings.Read`, `Sites.Read.All`, `Sites.ReadWrite.All`, `Files.Read.All`, and `Files.ReadWrite.All`.

Grant admin consent where the tenant requires it, then set the client and tenant IDs in `.env`. The REST flow uses OAuth 2.0 authorization-code + PKCE, signed session state, silent access-token refresh, and encrypted token files isolated per connected account. To allow multiple Microsoft accounts per user, configure the app registration for **any organizational directory and personal Microsoft accounts** as supported account types.

### API conventions

- Protected routes require the signed `outlook_session` HTTP-only cookie created by `/api/v1/auth/login`.
- Successful responses use `{ "data": ... }`; list responses may also include `pagination`.
- Errors use `{ "error": { "code", "message", "requestId", "details" } }`.
- Request IDs are accepted through `x-request-id` or generated and returned in the response header.
- `limit` is forwarded to Microsoft Graph-backed list tools and echoed in pagination metadata.
- `GET /health` is public and does not contact Microsoft Graph.

### Run the original MCP transport

The underlying Microsoft Graph tool implementations can still be run as an MCP server for Claude Desktop and other MCP clients, independent of the REST API:

```bash
npm run start:mcp
npm run auth:bootstrap
```

The REST API does not require an MCP client and is the default way to run this project.

## Features

- **AI Inbox Intelligence**: Groq (Llama 3.3) classifies inbound email and extracts structured meetings, deadlines, and action items into a queryable dashboard
- **Natural-Language Assistant**: describe what you want ("schedule a meeting with X tomorrow at 3pm and email them the agenda") and MicroNeuro resolves relative dates, asks for missing details, and executes the action(s) via Microsoft Graph
- **Multi-Account Support**: connect and switch between multiple Microsoft accounts without re-authenticating each time
- **Automated Deadline Alerts**: an hourly job flags upcoming and overdue deadlines and can notify by email
- **Email Operations**: read, search, send, reply to emails and download attachments
- **Calendar Management**: view and manage calendar events and appointments
- **SharePoint Integration**: access SharePoint files via sharing links or direct file IDs; download files shared to you via emails
- **Office Document Processing**: parse PDF, Word, PowerPoint, and Excel files with extracted text content
- **Receipt & Invoice Collection**: discover emailed receipts by sender/subject/date, save them as verified and consistently named PDFs (attachment, billing link, or rendered fallback), and stage a review draft — built for scheduled, non-interactive runs
- **Large File Support**: automatic handling of files that exceed response size limits
- **Optional Webhooks**: real-time inbox change notifications from Microsoft Graph instead of polling

## Configuration Reference

### Core environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AZURE_CLIENT_ID` | Yes | Your Azure AD application client ID |
| `AZURE_TENANT_ID` | Yes | Your Azure AD directory (tenant) ID |
| `AZURE_CLIENT_SECRET` | Yes | Your Azure AD application client secret |
| `DATABASE_URL` / `DIRECT_URL` | Yes | Supabase Postgres connection strings for Prisma |
| `GROQ_API_KEY` | Yes | Groq API key for extraction and the natural-language assistant |
| `MCP_OUTLOOK_WORK_DIR` | No | Directory for saving large files (defaults to system temp) |
| `MCP_OUTLOOK_ALLOWED_WRITE_DIRS` | No | Comma-separated extra directories save tools may write into when given an explicit `destDir`. Permission only — defaults are unchanged |
| `MCP_OUTLOOK_SHARED_MAILBOX` | No | Delegated/shared mailbox to read; empty = own mailbox |

The receipt/invoice-run behaviour below is configured **by the calling process** via environment variables:

| Variable | Description |
|----------|-------------|
| `MCP_OUTLOOK_RECEIPTS_DIR` | Directory where receipt/invoice PDFs are saved (falls back to work dir). Also passable per-call as `destDir`. |
| `RECEIPT_RULES_PATH` | Optional JSON file of site-specific vendor rules (see below). Unset = generic heuristics only. If set but missing/invalid, receipt tools fail fast rather than silently degrade. |
| `BILLING_DOMAIN_ALLOWLIST` | Comma-separated hosts `outlook_fetch_billing_pdf` may contact (default: `pay.stripe.com,invoice.stripe.com,files.stripe.com,m.stripe.network`) |
| `RECEIPT_FILENAME_TEMPLATE` | Receipt naming pattern (default: `{vendor} {DDMmmYY} Invoice.pdf`). Also passable per-vendor as `filenameTemplate`. |
| `MCP_OUTLOOK_AUTH_MODE` | `interactive` (default) or `headless` — headless never opens a browser and fails fast if silent refresh is impossible |
| `MCP_OUTLOOK_REFRESH_TOKEN_PATH` | Directory of the encrypted token store for headless runs (defaults to the built-in store) |
| `MCP_OUTLOOK_CHROME_PATH` | Chrome/Chromium binary for `outlook_render_email_pdf` (auto-detected when unset) |

#### Vendor rules (`RECEIPT_RULES_PATH`)

Receipt extraction works with zero configuration for receipts issued via payment processors that put the vendor in the subject line ("Your receipt from Acme #1234"). For senders that need explicit mapping, or to capture product labels, point `RECEIPT_RULES_PATH` at a JSON file (see [`receipt-rules.example.json`](receipt-rules.example.json)):

- `vendorSenders`: `[{ "pattern": "<case-insensitive regex on the from address>", "vendor": "<name>" }]` — checked before the subject heuristic.
- `productLabels`: `["<case-insensitive regex>", ...]` — first match becomes `productLabel`; without rules it is `null`.

### Receipt & Invoice-Run Tools

Five tools support autonomous expense-receipt collection (e.g. a scheduled monthly invoice run):

| Tool | Purpose |
|------|---------|
| `outlook_save_attachment` | Save an attachment's **original bytes** to a chosen path/filename. Auto-selects the `Invoice-*.pdf` when a Stripe receipt attaches both Invoice and Receipt PDFs (`prefer: invoice\|receipt\|first`). Validates `%PDF` magic bytes; returns path + SHA-256 + size. |
| `outlook_fetch_billing_pdf` | Fetch the PDF behind a billing link in an email body (fallback when a forward loses its attachment). HTTPS-only, allowlist-only (redirects included), content-type + magic-byte validated, 25 MB / 30 s bounded. |
| `outlook_extract_receipt` | Compact structured summary of a receipt email (vendor, amount, currency, receipt/invoice numbers, product label, billing link, attachment ids) — never the 60 KB+ HTML body. |
| `outlook_render_email_pdf` | Render the sanitised email HTML to PDF via headless Chrome — audit-trail fallback for receipts with no attachment and no link (e.g. app-store order receipts). |
| `outlook_collect_receipts` | One call per period: discovers each vendor's receipts by sender/subject/date across the whole mailbox, saves every PDF (attachment → link → rendered fallback), and returns a manifest plus `missing[]`. Idempotent re-runs via `onExisting: skip\|overwrite\|version`. |

`outlook_create_draft` additionally accepts `attachmentPaths` (absolute local file paths, ≤ 3 MB each) and returns the draft's `webLink` — it stages the email for review and **never sends**.

### Headless (Scheduled) Runs

1. Seed tokens once, interactively: `npm run auth:bootstrap` (opens the browser PKCE flow and stores an encrypted refresh token).
2. Set `MCP_OUTLOOK_AUTH_MODE=headless` for the scheduled run. The server refreshes silently and **never launches a browser**; if re-consent is genuinely required it fails fast with an actionable error telling you to re-run the bootstrap.
3. Optionally set `MCP_OUTLOOK_REFRESH_TOKEN_PATH` to point the run at a specific token store directory.

### Large File Handling

When downloading large attachments or SharePoint files, the server automatically detects when the response would exceed size limits and saves the content to local files instead.

- If `MCP_OUTLOOK_WORK_DIR` is set, large files are saved to this directory
- If not set, files are saved to the system temp directory
- Files are automatically named with timestamps to avoid conflicts
- Old files are periodically cleaned up to manage disk space

---

## Example Prompts

MicroNeuro's assistant endpoint (`POST /api/v1/assistant/prompt`) understands things like:

**Scheduling & Email**
- "Schedule a meeting with sara@example.com tomorrow at 3pm about the FYP demo"
- "Schedule a meeting with alice@example.com and bob@example.com next Tuesday afternoon and send them an email with the agenda"
- "Remind me about the quarterly report deadline next Friday"

If required details (time, attendees, etc.) are missing, MicroNeuro asks a clarifying question instead of guessing — reply with the missing info and it completes the request, using the conversation so far as context.

**Email Management** (via the underlying Graph-backed endpoints)
- "Show me my unread emails from this week"
- "Find all emails from John about the project proposal"
- "Send a reply to the last email from Sarah thanking her for the update"
- "Draft an email to the team summarizing today's meeting"

**Calendar**
- "What meetings do I have tomorrow?"
- "Show me my availability for the rest of the week"

**Attachments & SharePoint**
- "Download and summarize the PDF attachment from the latest email from Finance"
- "Get the contents of this SharePoint link: [paste link]"
- "What files were attached to emails from Legal this month?"

**Receipts & Invoices**
- "Collect all my June receipts into my receipts folder and give me the manifest"
- "Save the invoice PDF from the latest Acme receipt email as 'Acme 29Jun26 Invoice.pdf'"
- "Draft an email to my accountant with last month's receipt PDFs attached — don't send it"

**Office Document Processing**

The server automatically parses:
- **PDF files**: extracts text content
- **Word documents** (.docx): extracts text content
- **PowerPoint** (.pptx): extracts slide text
- **Excel** (.xlsx): parses data into structured format

---

## Authentication

MicroNeuro uses OAuth 2.0 with PKCE and supports multiple connected Microsoft accounts per user:

1. First login opens a browser for Microsoft authentication.
2. Tokens are encrypted and stored per connected account (OS keychain if available, otherwise encrypted file storage).
3. Add another account any time via `GET /api/v1/auth/login?addAccount=true` — this forces Microsoft's account picker (`prompt=select_account`) so you can sign into a different account without disturbing the currently active one.
4. Switch which account is active with `POST /api/v1/auth/switch-account`; every Graph call and dashboard query afterward operates on that account.
5. Automatic token refresh for long-term usage. No sensitive data stored in plain text.

Users who only ever connect a single Microsoft account see identical behavior to a traditional single-account setup — multi-account support is fully backward compatible.

### Required Permissions

The app requests these Microsoft Graph permissions:

- `Mail.Read`, `Mail.ReadWrite`, `Mail.Send` - Email access
- `Calendars.Read`, `Calendars.ReadWrite` - Calendar access
- `User.Read`, `MailboxSettings.Read` - User profile
- `Files.Read.All`, `Files.ReadWrite.All` - OneDrive/SharePoint files
- `Sites.Read.All`, `Sites.ReadWrite.All` - SharePoint sites
- `offline_access` - Refresh tokens

---

## Troubleshooting

### Large File Issues
- **Problem**: "Result exceeds maximum length" error
- **Solution**: Ensure `MCP_OUTLOOK_WORK_DIR` is set and writable
- **Alternative**: Files automatically save to system temp if work dir not configured

### Authentication Issues
- **Problem**: Authentication failures
- **Solution**: Verify Azure AD app permissions and client ID/secret
- **Reset**: Clear stored tokens and re-authenticate, or remove and re-add the connected account via `POST /api/v1/auth/remove-account`

### Database / Migration Issues
- **Problem**: `P1001: Can't reach database server` when running `prisma migrate dev`
- **Solution**: Confirm `DATABASE_URL` and `DIRECT_URL` point to your Supabase project (not a different provisioned database), and that any special characters in the database password are URL-encoded. Retry — pooled connections can occasionally be transiently unreachable.
- **Drift detected**: If Prisma reports schema drift on a database that already has the expected tables (e.g. tables were created manually via the Supabase SQL editor), use `npx prisma migrate resolve --applied <migration_name>` to mark already-applied migrations instead of resetting the database.

### SharePoint Access Issues
- **Problem**: Cannot access SharePoint files
- **Solution**: Ensure sharing links are valid and user has access permissions
- **Alternative**: Use direct file ID access if available

---

## Development

### Project Structure
```
microneuro/
├── server/
│   ├── index.js              # Original MCP server (retained)
│   ├── api/                  # Express REST API (default entry point)
│   ├── auth/                 # Authentication + multi-account token management
│   ├── graph/                # Microsoft Graph API client
│   ├── schemas/              # Request/tool schemas
│   ├── tools/                # Graph tool implementations
│   │   ├── attachments/      # Attachment tools
│   │   ├── calendar/         # Calendar tools
│   │   ├── email/            # Email tools
│   │   ├── folders/          # Folder management
│   │   ├── receipts/         # Receipt/invoice-run tools
│   │   └── sharepoint/       # SharePoint tools
│   └── utils/                # Utility modules
├── services/
│   ├── intelligence.js       # Inbox sync, extraction persistence, active-account resolution
│   └── assistantIntent.js    # Groq prompt interpretation for the natural-language assistant
├── prisma/
│   └── schema.prisma         # User, ConnectedAccount, ProcessedEmail, Meeting, Deadline,
│                              # ActionItem, Alert, Settings, WebhookSubscription
└── package.json
```

### Running Tests
```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:benchmark      # Performance benchmarks
```

### Debugging
```bash
npm run test:graph          # Test Graph API connection
```

### Database
```bash
npm run db:generate         # Regenerate the Prisma client after schema changes
npm run db:migrate          # Create and apply a migration in development
npm run db:migrate:deploy   # Apply pending migrations (e.g. in production)
```

---

## Author

Muhammad Ali — muhammadbvs2021@gmail.com