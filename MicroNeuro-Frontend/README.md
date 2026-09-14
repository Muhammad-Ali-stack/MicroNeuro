# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.


src/
├── main.jsx                    (keep, tiny change)
├── App.jsx                     (rewrite - just router + auth guard)
├── styles.css                  (keep)
├── lib/
│   └── api.js                  (keep your existing one)
├── components/
│   ├── BrandIcons.jsx          (keep)
│   ├── Layout/
│   │   ├── AppShell.jsx        (sidebar + main wrapper)
│   │   ├── Sidebar.jsx         (fixed sidebar)
│   │   └── Topbar.jsx          (top header)
│   └── ui/
│       ├── Logo.jsx
│       ├── EmptyState.jsx
│       └── LoadingScreen.jsx
├── hooks/
│   ├── useAuth.jsx             (auth context + hook)
│   └── useTheme.jsx
└── pages/
    ├── Login.jsx               (Microsoft OAuth login)
    ├── AuthCallback.jsx        (handles /auth/callback redirect)
    ├── Dashboard.jsx
    ├── Inbox.jsx
    ├── Calendar.jsx
    ├── Meetings.jsx
    ├── Deadlines.jsx
    ├── Actions.jsx
    ├── Alerts.jsx
    ├── Assistant.jsx
    ├── Files.jsx
    ├── Accounts.jsx
    ├── Settings.jsx
    ├── McpConnection.jsx
    └── ComingSoon.jsx
# Outlook REST API v1

This document describes the REST API implemented by this repository. It is the source of truth for the Express adapter in `server/api/`. The API wraps Microsoft Graph services and Outlook tool implementations, and adds an AI-powered intelligence layer (Groq-based email extraction, meeting/deadline/action-item tracking, alerts, and settings) backed by Prisma + Supabase Postgres.

## Base URLs and authentication

- Local base URL: `http://localhost:5000`
- API prefix: `/api/v1`
- Public health check: `GET /health`
- OAuth start: `GET /api/v1/auth/login`
- Protected endpoints require the signed, HTTP-only `outlook_session` cookie created by the OAuth start endpoint.
- Microsoft access and refresh tokens are never returned in JSON. They are encrypted in a per-session storage directory.
- Intelligence/dashboard endpoints additionally require a corresponding `User` row in the database, which is automatically created/looked up (`ensureDatabaseUser`) on first authenticated call.

## Endpoint table

All rows marked **session** require Microsoft authentication. Query parameters are shown after `?`; path parameters use `:name`.

### Core Outlook / Graph endpoints

| Method | URL | Auth | Operation |
| --- | --- | --- | --- |
| GET | `/health` | public | Service health |
| GET | `/api/v1` | public | API metadata |
| GET | `/api/v1/auth/login` | public | Create PKCE login URL (optional `addAccount=true`) |
| GET | `/api/v1/auth/callback` | OAuth callback | Exchange authorization code, create/lookup ConnectedAccount |
| GET | `/api/v1/auth/me` | session | Current user + active connected account |
| POST | `/api/v1/auth/logout` | optional | Clear session and tokens |
| GET | `/api/v1/auth/accounts` | session | List all connected Microsoft accounts |
| POST | `/api/v1/auth/switch-account` | session | Set a connected account as active |
| POST | `/api/v1/auth/remove-account` | session | Remove a connected account and its tokens |
| GET | `/api/v1/outlook/messages/search` | session | Search messages |
| GET | `/api/v1/outlook/messages` | session | List messages |
| GET | `/api/v1/outlook/messages/:messageId` | session | Read one message |
| POST | `/api/v1/outlook/messages/send` | session | Send message |
| POST | `/api/v1/outlook/drafts` | session | Create draft |
| POST | `/api/v1/outlook/messages/:messageId/reply` | session | Reply |
| POST | `/api/v1/outlook/messages/:messageId/reply-all` | session | Reply all |
| POST | `/api/v1/outlook/messages/:messageId/forward` | session | Forward |
| DELETE | `/api/v1/outlook/messages/:messageId` | session | Delete |
| POST | `/api/v1/outlook/messages/:messageId/move` | session | Move |
| PATCH | `/api/v1/outlook/messages/:messageId/read` | session | Mark read/unread |
| PATCH | `/api/v1/outlook/messages/:messageId/flag` | session | Set flag |
| PATCH | `/api/v1/outlook/messages/:messageId/categories` | session | Set categories |
| POST | `/api/v1/outlook/messages/:messageId/archive` | session | Archive |
| POST | `/api/v1/outlook/messages/batch` | session | Batch message operation |
| GET | `/api/v1/calendar/events` | session | List calendar events |
| POST | `/api/v1/calendar/events` | session | Create event |
| GET | `/api/v1/calendar/events/:eventId` | session | Read event |
| PATCH | `/api/v1/calendar/events/:eventId` | session | Update event |
| DELETE | `/api/v1/calendar/events/:eventId` | session | Delete event |
| POST | `/api/v1/calendar/events/:eventId/respond` | session | Respond to invite |
| POST | `/api/v1/calendar/validate-datetimes` | session | Validate event dates |
| POST | `/api/v1/calendar/recurring-events` | session | Create recurring event |
| POST | `/api/v1/calendar/meeting-times` | session | Find meeting times |
| POST | `/api/v1/calendar/availability` | session | Check availability |
| POST | `/api/v1/calendar/online-meetings` | session | Schedule online meeting |
| GET | `/api/v1/calendar/calendars` | session | List calendars |
| GET | `/api/v1/calendar/view` | session | Calendar view |
| POST | `/api/v1/calendar/busy-times` | session | Get busy times |
| POST | `/api/v1/calendar/recurrence-pattern` | session | Build recurrence pattern |
| POST | `/api/v1/calendar/recurrence-helper` | session | Create recurrence helper |
| GET | `/api/v1/calendar/permissions/:calendarId` | session | Check calendar permissions |
| GET | `/api/v1/outlook/folders` | session | List folders |
| POST | `/api/v1/outlook/folders` | session | Create folder |
| PATCH | `/api/v1/outlook/folders/:folderId` | session | Rename folder |
| GET | `/api/v1/outlook/folders/:folderId/stats` | session | Folder statistics |
| GET | `/api/v1/outlook/messages/:messageId/attachments` | session | List attachments |
| GET | `/api/v1/outlook/messages/:messageId/attachments/:attachmentId` | session | Download attachment |
| POST | `/api/v1/outlook/messages/:messageId/attachments` | session | Add attachment |
| GET | `/api/v1/outlook/attachments/scan` | session | Scan attachments |
| GET | `/api/v1/sharepoint/file` | session | Read SharePoint file |
| GET | `/api/v1/sharepoint/files` | session | List SharePoint files |
| GET | `/api/v1/sharepoint/resolve` | session | Resolve SharePoint link |
| POST | `/api/v1/receipts/attachments/save` | session | Save receipt attachment |
| POST | `/api/v1/receipts/billing-pdf` | session | Fetch billing PDF |
| POST | `/api/v1/receipts/extract` | session | Extract receipt |
| POST | `/api/v1/receipts/render-email-pdf` | session | Render email as PDF |
| POST | `/api/v1/receipts/collect` | session | Collect receipts |
| GET | `/api/v1/system/rate-limit` | session | Rate-limit metrics |
| POST | `/api/v1/system/rate-limit/reset` | session | Reset rate-limit metrics |

### Intelligence / dashboard endpoints (new)

| Method | URL | Auth | Operation |
| --- | --- | --- | --- |
| POST | `/api/v1/sync/inbox` | session | Fetch inbox, run Groq extraction, persist results |
| POST | `/api/v1/assistant/prompt` | session | Interpret natural-language prompt and execute create meeting / send email / create deadline reminder |
| GET | `/api/v1/dashboard/summary` | session | Aggregate counts + recent items across all types |
| GET | `/api/v1/meetings` | session | List extracted meetings |
| GET | `/api/v1/deadlines` | session | List extracted deadlines |
| GET | `/api/v1/action-items` | session | List extracted action items |
| PATCH | `/api/v1/action-items/:id` | session | Update action item status |
| GET | `/api/v1/alerts` | session | List generated alerts |
| PATCH | `/api/v1/alerts/:id/read` | session | Mark alert as read |
| GET | `/api/v1/settings` | session | Get user settings (auto-created with defaults) |
| PATCH | `/api/v1/settings` | session | Update user settings |
| POST | `/api/v1/webhooks/outlook/subscribe` | session | Create Graph change-notification subscription |
| POST | `/api/v1/webhooks/outlook/notifications` | public (Graph-called) | Receive Graph webhook notifications |

## Common response and error contract

Successful JSON responses are wrapped in `data`:

```json
{ "data": { "id": "message-id", "subject": "Quarterly update" } }
```

List operations that accept `limit` also return:

```json
{
  "data": { "emails": [], "count": 0 },
  "pagination": { "limit": 10, "count": 0, "hasMore": false }
}
```

`limit` is passed to the existing tool and Microsoft Graph. `hasMore` is a conservative indicator (`count === limit`); Graph continuation links remain in the underlying tool response when available.

Errors:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid parameter 'messageId': Parameter is required",
    "requestId": "7c6c..."
  }
}
```

Possible HTTP statuses are `400` validation, `401` missing/expired authentication, `404` unknown route/resource, `429` Graph rate limiting, `500` unexpected server error, and `503` OAuth not configured or database unreachable. Internal stack traces and token values are never sent to clients.

## Authentication endpoints

### `GET /api/v1/auth/login`

Creates a browser session and returns a Microsoft authorization URL. No request body. Save cookies (`curl -c cookies.txt`) and send them to all protected routes (`curl -b cookies.txt`).

| Query param | Type | Notes |
| --- | --- | --- |
| `addAccount` | boolean | When `true`, the authorization URL includes `prompt=select_account` so the user can sign into a different Microsoft account. Omit for the initial login. |

Example response:

```json
{
  "data": {
    "authorizationUrl": "https://login.microsoftonline.com/.../authorize?...",
    "redirectUri": "http://localhost:5000/api/v1/auth/callback"
  }
}
```

### `GET /api/v1/auth/callback`

Microsoft redirects here with `code` and `state` query parameters. The API validates the signed session's state, exchanges the code with PKCE, stores encrypted tokens, and returns a small HTML success page. `error` and `error_description` produce a `400` HTML response. This endpoint must match the URI registered in Microsoft Entra ID.

After the token exchange, the API calls Microsoft Graph `/me` to get the authenticated account's `id`, `mail`, and `displayName`. It then looks up or creates a `ConnectedAccount` row (matched by `microsoftAccountId`). The first account for a session becomes `isActive: true` automatically; additional accounts are added without changing the currently active one. Tokens are stored scoped to the connected account so switching accounts later uses the correct credentials.

### `GET /api/v1/auth/me`

Returns `{ "data": { "authenticated": true, "user": { "id", "displayName", "mail" }, "activeConnectedAccount": { "id", "email", "displayName", "isActive" } } }`. Requires the session cookie. `activeConnectedAccount` is `null` if no connected account has been linked yet.

### `POST /api/v1/auth/logout`

Clears the session cookie and encrypted tokens. It is safe to call without a session. Example response: `{ "data": { "loggedOut": true } }`.

### `GET /api/v1/auth/accounts`

Lists all `ConnectedAccount` rows for the current app user. Requires the session cookie.

Example response:

```json
{
  "data": [
    { "id": "cm...", "email": "alice@work.com", "displayName": "Alice", "isActive": true, "connectedAt": "2026-08-15T..." },
    { "id": "cm...", "email": "alice@personal.com", "displayName": "Alice P", "isActive": false, "connectedAt": "2026-08-15T..." }
  ]
}
```

### `POST /api/v1/auth/switch-account`

Sets one connected account as active and all others inactive. Future Graph requests and intelligence queries will operate on this account.

Request body:

```json
{ "connectedAccountId": "cm..." }
```

Example response:

```json
{ "data": { "switchedTo": { "id": "cm...", "email": "alice@personal.com", "displayName": "Alice P" } } }
```

### `POST /api/v1/auth/remove-account`

Removes a connected account and its stored tokens. If the removed account was active, the next remaining account (oldest first) is auto-selected as active. If no accounts remain, the session is fully logged out.

Request body:

```json
{ "connectedAccountId": "cm..." }
```

Example response (auto-switched):

```json
{ "data": { "removed": "cm...", "autoSwitchedTo": { "id": "cm...", "email": "alice@work.com" } } }
```

Example response (no accounts left):

```json
{ "data": { "removed": "cm...", "loggedOut": true } }
```

## Outlook email endpoints

All `GET` fields below are query parameters. All `POST`/`PATCH` fields below are JSON body fields. `messageId` is a path parameter.

| Endpoint | Fields |
| --- | --- |
| `GET /outlook/messages` | `folder` optional (default `inbox`, accepts Graph well-known names such as `sentitems`, `drafts`, `deleteditems`, `junkemail`, `archive`), `limit` optional, `filter` optional |
| `GET /outlook/messages/search` | `query`, `subject`, `from`, `startDate`, `endDate`, `folders`, `limit`, `includeBody`, `truncate`, `maxLength`, `format`, `orderBy` |
| `GET /outlook/messages/:messageId` | `truncate`, `maxLength`, `format` |
| `POST /outlook/messages/send` | required `to`, `subject`; `body`, `bodyType`, `cc`, `bcc`, `preserveUserStyling` |
| `POST /outlook/drafts` | required `to`, `subject`; `body`, `bodyType`, `bodyHtml`, `cc`, `bcc`, `importance`, `attachmentPaths` |
| `POST /outlook/messages/:messageId/reply` | `body`, `bodyType`, `comment` |
| `POST /outlook/messages/:messageId/reply-all` | `body`, `bodyType`, `comment` |
| `POST /outlook/messages/:messageId/forward` | required `to`; `body`, `bodyType`, `comment` |
| `DELETE /outlook/messages/:messageId` | `permanentDelete` |
| `POST /outlook/messages/:messageId/move` | required `destinationFolderId` |
| `PATCH /outlook/messages/:messageId/read` | required `isRead` |
| `PATCH /outlook/messages/:messageId/flag` | required `flagStatus` |
| `PATCH /outlook/messages/:messageId/categories` | required `categories` |
| `POST /outlook/messages/:messageId/archive` | no body |
| `POST /outlook/messages/batch` | required `messageIds`, `operation`; `operationData` |

Example send:

```bash
curl -b cookies.txt -X POST http://localhost:5000/api/v1/outlook/messages/send \
  -H 'content-type: application/json' \
  -d '{"to":["person@example.com"],"subject":"Hello","body":"Message body","bodyType":"text"}'
```

**Sent items:** The existing `GET /outlook/messages` route lists sent mail when called with the Graph well-known folder name `sentitems` — no separate route is needed:

```bash
curl -b cookies.txt "http://localhost:5000/api/v1/outlook/messages?folder=sentitems&limit=10"
```

Response uses the same list shape as any `GET /outlook/messages` call:

```json
{
  "data": { "emails": [ { "id": "...", "subject": "...", "from": "...", "receivedDateTime": "...", "preview": "...", "isRead": true } ], "count": 1 },
  "pagination": { "limit": 10, "count": 1, "hasMore": false }
}
```

## Calendar endpoints

| Endpoint | Fields |
| --- | --- |
| `GET /calendar/events` | `startDateTime`, `endDateTime`, `limit`, `calendar` |
| `POST /calendar/events` | required `subject`, `start`, `end`; `body`, `location`, `attendees`, `isOnlineMeeting`, `onlineMeetingProvider`, `recurrence` |
| `GET /calendar/events/:eventId` | no query fields |
| `PATCH /calendar/events/:eventId` | `subject`, `body`, `location`, `start`, `end`, `attendees` |
| `DELETE /calendar/events/:eventId` | no body |
| `POST /calendar/events/:eventId/respond` | required `response`; `comment`, `sendResponse` |
| `POST /calendar/validate-datetimes` | required `start`, `end` |
| `POST /calendar/recurring-events` | required `subject`, `start`, `end`, `recurrencePattern`; `body`, `location`, `attendees`, `isOnlineMeeting` |
| `POST /calendar/meeting-times` | required `attendees`; `timeConstraint`, `meetingDuration`, `maxCandidates` |
| `POST /calendar/availability` | required `schedules`, `startTime`, `endTime`; `availabilityViewInterval` |
| `POST /calendar/online-meetings` | required `subject`, `startTime`, `endTime`; `attendees`, `meetingProvider` |
| `GET /calendar/calendars` | `includeSharedCalendars`, `top` |
| `GET /calendar/view` | required `startDateTime`, `endDateTime`; `calendarId`, `top` |
| `POST /calendar/busy-times` | required `schedules`, `startTime`, `endTime`; `availabilityViewInterval` |
| `POST /calendar/recurrence-pattern` | `patternType`, `interval`, `daysOfWeek`, `dayOfMonth`, `monthOfYear`, `index`, `rangeType`, `numberOfOccurrences`, `rangeStartDate`, `rangeEndDate` |
| `POST /calendar/recurrence-helper` | `eventTitle`, `startDateTime`, `endDateTime`, `recurrenceType`, `endAfter`, `occurrences`, `endDate` |
| `GET /calendar/permissions/:calendarId` | no query fields |

Example create event:

```json
{
  "subject": "Planning",
  "start": { "dateTime": "2026-08-20T10:00:00Z", "timeZone": "UTC" },
  "end": { "dateTime": "2026-08-20T11:00:00Z", "timeZone": "UTC" },
  "attendees": ["person@example.com"]
}
```

## Folder and attachment endpoints

| Endpoint | Fields |
| --- | --- |
| `GET /outlook/folders` | `includeHidden`, `includeChildFolders`, `top` |
| `POST /outlook/folders` | required `displayName`; `parentFolderId` |
| `PATCH /outlook/folders/:folderId` | required `newDisplayName` |
| `GET /outlook/folders/:folderId/stats` | `includeSubfolders` |
| `GET /outlook/messages/:messageId/attachments` | required path `messageId` |
| `GET /outlook/messages/:messageId/attachments/:attachmentId` | `includeContent`, `decodeContent` |
| `POST /outlook/messages/:messageId/attachments` | required `name`, `contentType`, `contentBytes` |
| `GET /outlook/attachments/scan` | `folder`, `maxSizeMB`, `suspiciousTypes`, `limit`, `daysBack` |

Attachment content is sent as base64 JSON to keep the API transport-independent. Existing large-file handling and size limits remain in the tools.

## SharePoint endpoints

| Endpoint | Fields |
| --- | --- |
| `GET /sharepoint/file` | required `sharePointUrl` or `fileId`; `driveId`, `downloadContent` |
| `GET /sharepoint/files` | required `siteId`; `driveId`, `folderId`, `limit`, `orderBy` |
| `GET /sharepoint/resolve` | required `sharePointUrl`; `includePermissions` |

SharePoint responses can include parsed text, Excel data, office-document text, or base64 content depending on the file type and the existing tool's large-file policy.

## Receipt and invoice endpoints

| Endpoint | Fields |
| --- | --- |
| `POST /receipts/attachments/save` | `messageId`, `attachmentId`, `attachmentName`, `contentType`, `prefer`, `destDir`, `fileName`, `filenameTemplate`, `vendor`, `onExisting` |
| `POST /receipts/billing-pdf` | `messageId` or `url`; `destDir`, `fileName`, `onExisting` |
| `POST /receipts/extract` | required `messageId` |
| `POST /receipts/render-email-pdf` | required `messageId`; `destDir`, `fileName`, `onExisting` |
| `POST /receipts/collect` | required `periodStart`, `periodEnd`; `vendors`, `destDir`, `onExisting` |

These endpoints return JSON describing saved paths, extraction results, review drafts, or tool errors. They preserve the repository's allowlists and receipt rules; paths and URLs are not trusted blindly.

## System endpoints

`GET /api/v1/system/rate-limit` returns the existing rate-limit metrics. `POST /api/v1/system/rate-limit/reset` resets those metrics and accepts the tool's optional JSON body. Both require a session.

---

## Intelligence and dashboard endpoints

These endpoints back the AI email assistant: they read Outlook mail via the existing Graph integration, classify and extract structured data using Groq (`llama-3.3-70b-versatile`), persist results with Prisma to Supabase Postgres, and expose read/update routes for a dashboard frontend.

### Multi-account support

The API supports connecting multiple Microsoft accounts per app user. Each connected account is stored as a `ConnectedAccount` row linked to the `User` table. Tokens are stored per connected account, and all Graph requests and intelligence queries operate on the currently active account. Use `GET /api/v1/auth/login?addAccount=true` to add a second account, `GET /api/v1/auth/accounts` to list them, `POST /api/v1/auth/switch-account` to change the active one, and `POST /api/v1/auth/remove-account` to disconnect one. Users with only one connected account see identical behavior to the pre-multi-account API. Dashboard, meetings, deadlines, and action-items endpoints accept an optional `?allAccounts=true` query parameter to aggregate across all connected accounts instead of just the active one.

### `POST /api/v1/sync/inbox`

Fetches recent inbox messages (via the existing internal Graph message-listing logic — no duplicate implementation), skips any message already present in `ProcessedEmail` (matched by `graphMessageId`), and for each new message calls the Groq extraction service. Depending on the returned `emailType`, a related `Meeting`, `Deadline`, or `ActionItem` row is created; emails classified as `"other"` (promotional, automated, banking, security notices, etc.) are recorded in `ProcessedEmail` but produce no child row. A single failed extraction is logged and skipped rather than aborting the whole sync. All extracted records are scoped to the currently active connected account.

No request body required.

Example response:

```json
{
  "data": {
    "processed": 8,
    "skipped": 42,
    "total": 50
  }
}
```

- `processed` — new emails run through Groq and saved this call
- `skipped` — emails already present in `ProcessedEmail` from a prior sync
- `total` — messages fetched from the folder for this sync pass

### `POST /api/v1/assistant/prompt`

Interprets a free-text user prompt through Groq (`llama-3.3-70b-versatile`, temperature 0.1, JSON-object response) and, when enough information is provided, executes the underlying action without reimplementing Graph API logic:

- `"create_meeting"` → delegates to the same internal function used by `POST /api/v1/calendar/events` (`createEventTool`).
- `"send_email"` → delegates to the same internal function used by `POST /api/v1/outlook/messages/send` (`sendEmailTool`).
- `"create_deadline_reminder"` → creates a `Deadline` row scoped to the current session's database user and active connected account (`status` defaults to `"upcoming"`).
- `"unknown"` — when the model cannot classify the request.

Relative dates/times such as "tomorrow", "next Thursday", or "in 2 days" are resolved into concrete ISO 8601 values based on the server's current time. If the intent is clear but a required field is missing or ambiguous, the route asks for clarification rather than inventing a value.

Request body:

```json
{
  "prompt": "schedule a project sync with alice@example.com and bob@example.com tomorrow at 3pm for 1 hour"
}
```

The request body also accepts an optional `conversationHistory` array of `{ "role": "user"|"assistant", "content": string }` entries. When provided, history is sent to Groq as prior messages and the current prompt is treated as additional information for the SAME request being built up across the conversation — details from every earlier user message are merged with the current message. A follow-up that completes a previously incomplete request returns `status: "ready"` instead of `"completed"`.

Example request with conversation history:

```json
{
  "prompt": "End time is 4pm, attendee is sara@example.com, no specific location",
  "conversationHistory": [
    { "role": "user", "content": "Schedule a meeting with Sara tomorrow at 3pm about the FYP demo" },
    { "role": "assistant", "content": "I need more info for that meeting." }
  ]
}
```

Example response — completed create meeting:

```json
{
  "data": {
    "status": "completed",
    "action": "create_meeting",
    "result": {
      "id": "AAMkAD...",
      "subject": "Project sync",
      "start": { "dateTime": "2026-08-16T10:00:00Z", "timeZone": "UTC" },
      "end": { "dateTime": "2026-08-16T11:00:00Z", "timeZone": "UTC" }
    }
  }
}
```

Example response — completed send email:

```json
{
  "data": {
    "status": "completed",
    "action": "send_email",
    "result": { "text": "Email sent successfully to alice@example.com" }
  }
}
```

Example response — completed create deadline reminder:

```json
{
  "data": {
    "status": "completed",
    "action": "create_deadline_reminder",
    "result": {
      "id": "cmsu3fngo0002u8zo3zfz55lh",
      "userId": "cmsu3fmub0000u8zoxf6q4loy",
      "emailId": null,
      "description": "Submit quarterly report",
      "dueDate": "2026-08-22T23:59:59.000Z",
      "status": "upcoming"
    }
  }
}
```

Example response — needs clarification:

```json
{
  "data": {
    "status": "needs_clarification",
    "missingFields": ["attendees"],
    "message": "I need a bit more info: attendees"
  }
}
```

Example response — unknown prompt:

```json
{
  "data": {
    "status": "unknown",
    "message": "I couldn't understand that request. Try something like 'schedule a meeting with X tomorrow at 3pm' or 'send an email to X about Y'."
  }
}
```

A missing/empty `prompt` returns `400 VALIDATION_ERROR` with `"prompt is required."`. Any server-side failure is logged and converted to the standard error contract (`500 REQUEST_FAILED` without stack traces).

### `GET /api/v1/dashboard/summary`

Returns aggregate counts and the five most recent items of each type for the current user. Backed entirely by Prisma reads — no Graph or Groq calls.

| Field | Type | Notes |
| --- | --- | --- |
| `allAccounts` (query, optional) | boolean | When `true`, aggregates data across all connected accounts. Defaults to the active account only. |

Example response:

```json
{
  "data": {
    "counts": {
      "meetings": 3,
      "deadlines": 5,
      "actionItems": 2,
      "unreadAlerts": 1
    },
    "recent": {
      "meetings": [],
      "deadlines": [],
      "actionItems": [],
      "emails": []
    }
  }
}
```

### `GET /api/v1/meetings`

Lists `Meeting` rows for the current user, newest first.

| Field | Type | Notes |
| --- | --- | --- |
| `status` (query, optional) | string | Filter, e.g. `pending`/`uploaded`/`not-required` (`momStatus`) |
| `allAccounts` (query, optional) | boolean | When `true`, includes meetings from all connected accounts. Defaults to the active account only. |

### `GET /api/v1/deadlines`

Lists `Deadline` rows for the current user, sorted by `dueDate` ascending.

| Field | Type | Notes |
| --- | --- | --- |
| `status` (query, optional) | string | `upcoming` \| `overdue` \| `completed` |
| `allAccounts` (query, optional) | boolean | When `true`, includes deadlines from all connected accounts. Defaults to the active account only. |

### `GET /api/v1/action-items`

Lists `ActionItem` rows for the current user.

| Field | Type | Notes |
| --- | --- | --- |
| `allAccounts` (query, optional) | boolean | When `true`, includes action items from all connected accounts. Defaults to the active account only. |

### `PATCH /api/v1/action-items/:id`

Updates the status of an action item.

Request body:

```json
{ "status": "done" }
```

Valid values: `open`, `done`.

### `GET /api/v1/alerts`

Lists `Alert` rows for the current user, newest first.

| Field | Type | Notes |
| --- | --- | --- |
| `unreadOnly` (query, optional) | boolean | Return only unread alerts when `true` |

### `PATCH /api/v1/alerts/:id/read`

Marks a single alert as read. No request body required.

### `GET /api/v1/settings`

Returns the current user's `Settings` row, creating a default row on first access.

Example response:

```json
{
  "data": {
    "id": "cmsu3fngo0002u8zo3zfz55lh",
    "userId": "cmsu3fmub0000u8zoxf6q4loy",
    "alertLeadTimeHours": 24,
    "foldersToScan": ["inbox"],
    "notifyByEmail": false
  }
}
```

### `PATCH /api/v1/settings`

Updates one or more settings fields.

Request body (all optional):

```json
{
  "alertLeadTimeHours": 48,
  "foldersToScan": ["inbox", "Projects"],
  "notifyByEmail": true
}
```

### Alerts background job

An hourly scheduled job (`node-cron`) queries `Deadline` rows due within each user's `alertLeadTimeHours` window with `status = "upcoming"`, and creates an `Alert` row if one doesn't already exist for that deadline. The same job updates any `Deadline` whose `dueDate` has passed to `status = "overdue"`. If a user's `notifyByEmail` setting is `true`, an email is also sent via the existing Graph send-mail logic.

## Webhook endpoints

### `POST /api/v1/webhooks/outlook/subscribe`

Creates a Microsoft Graph change-notification subscription on the user's inbox (`resource: /me/mailFolders('inbox')/messages`, `changeType: created`), pointed at this API's public notification receiver. Requires `PUBLIC_BASE_URL` to be set to a publicly reachable HTTPS URL (a local dev tunnel such as ngrok, or a deployed URL). The returned Graph `subscriptionId` is stored in `WebhookSubscription` along with its expiry.

### `POST /api/v1/webhooks/outlook/notifications`

Public endpoint called directly by Microsoft Graph — not by the frontend, and not session-protected.

- On subscription creation, Graph calls this URL with a `validationToken` query parameter; the endpoint echoes it back as plain text with a `200` status.
- On subsequent notifications, the endpoint responds `202` immediately (per Graph's requirement), then asynchronously resolves the subscription to a user, fetches the referenced message, and runs it through the same extraction path as `/sync/inbox`.
- Requests are validated against `WEBHOOK_CLIENT_STATE` to confirm they originate from the legitimate subscription.

A separate daily cron job renews any `WebhookSubscription` expiring within 24 hours, since Graph mail subscriptions expire roughly every 3 days.

**Known limitation:** webhook notification processing currently depends on an active, authenticated in-memory session for the affected user. Processing that arrives after a server restart (before the user's session is re-established) is not yet handled and is a proposed follow-up.

## Required environment variables

| Variable | Used by |
| --- | --- |
| `DATABASE_URL` | Prisma runtime queries (Supabase pooler connection, port 6543) |
| `DIRECT_URL` | Prisma migrations (Supabase direct connection, port 5432) |
| `GROQ_API_KEY` | Groq extraction service |
| `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET` | Microsoft OAuth / Graph API access |
| `SESSION_SECRET` | Session cookie signing |
| `PUBLIC_BASE_URL` | Webhook subscription notification URL (required only for webhook endpoints) |
| `WEBHOOK_CLIENT_STATE` | Webhook request validation (required only for webhook endpoints) |