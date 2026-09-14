import * as tools from '../tools/index.js';
import { allToolSchemaMap } from '../schemas/toolSchemas.js';

const specs = [
  ['outlook_search_emails', 'searchEmailsTool', 'GET', '/api/v1/outlook/messages/search', 'email'],
  ['outlook_list_emails', 'listEmailsTool', 'GET', '/api/v1/outlook/messages', 'email'],
  ['outlook_get_email', 'getEmailTool', 'GET', '/api/v1/outlook/messages/:messageId', 'email'],
  ['outlook_send_email', 'sendEmailTool', 'POST', '/api/v1/outlook/messages/send', 'email'],
  ['outlook_create_draft', 'createDraftTool', 'POST', '/api/v1/outlook/drafts', 'email'],
  ['outlook_reply_to_email', 'replyToEmailTool', 'POST', '/api/v1/outlook/messages/:messageId/reply', 'email'],
  ['outlook_reply_all', 'replyAllTool', 'POST', '/api/v1/outlook/messages/:messageId/reply-all', 'email'],
  ['outlook_forward_email', 'forwardEmailTool', 'POST', '/api/v1/outlook/messages/:messageId/forward', 'email'],
  ['outlook_delete_email', 'deleteEmailTool', 'DELETE', '/api/v1/outlook/messages/:messageId', 'email'],
  ['outlook_move_email', 'moveEmailTool', 'POST', '/api/v1/outlook/messages/:messageId/move', 'email'],
  ['outlook_mark_as_read', 'markAsReadTool', 'PATCH', '/api/v1/outlook/messages/:messageId/read', 'email'],
  ['outlook_flag_email', 'flagEmailTool', 'PATCH', '/api/v1/outlook/messages/:messageId/flag', 'email'],
  ['outlook_categorize_email', 'categorizeEmailTool', 'PATCH', '/api/v1/outlook/messages/:messageId/categories', 'email'],
  ['outlook_archive_email', 'archiveEmailTool', 'POST', '/api/v1/outlook/messages/:messageId/archive', 'email'],
  ['outlook_batch_process_emails', 'batchProcessEmailsTool', 'POST', '/api/v1/outlook/messages/batch', 'email'],

  ['outlook_list_events', 'listEventsTool', 'GET', '/api/v1/calendar/events', 'calendar'],
  ['outlook_create_event', 'createEventTool', 'POST', '/api/v1/calendar/events', 'calendar'],
  ['outlook_get_event', 'getEventTool', 'GET', '/api/v1/calendar/events/:eventId', 'calendar'],
  ['outlook_update_event', 'updateEventTool', 'PATCH', '/api/v1/calendar/events/:eventId', 'calendar'],
  ['outlook_delete_event', 'deleteEventTool', 'DELETE', '/api/v1/calendar/events/:eventId', 'calendar'],
  ['outlook_respond_to_invite', 'respondToInviteTool', 'POST', '/api/v1/calendar/events/:eventId/respond', 'calendar'],
  ['outlook_validate_event_datetimes', 'validateEventDateTimesTool', 'POST', '/api/v1/calendar/validate-datetimes', 'calendar'],
  ['outlook_create_recurring_event', 'createRecurringEventTool', 'POST', '/api/v1/calendar/recurring-events', 'calendar'],
  ['outlook_find_meeting_times', 'findMeetingTimesTool', 'POST', '/api/v1/calendar/meeting-times', 'calendar'],
  ['outlook_check_availability', 'checkAvailabilityTool', 'POST', '/api/v1/calendar/availability', 'calendar'],
  ['outlook_schedule_online_meeting', 'scheduleOnlineMeetingTool', 'POST', '/api/v1/calendar/online-meetings', 'calendar'],
  ['outlook_list_calendars', 'listCalendarsTool', 'GET', '/api/v1/calendar/calendars', 'calendar'],
  ['outlook_get_calendar_view', 'getCalendarViewTool', 'GET', '/api/v1/calendar/view', 'calendar'],
  ['outlook_get_busy_times', 'getBusyTimesTool', 'POST', '/api/v1/calendar/busy-times', 'calendar'],
  ['outlook_build_recurrence_pattern', 'buildRecurrencePatternTool', 'POST', '/api/v1/calendar/recurrence-pattern', 'calendar'],
  ['outlook_create_recurrence_helper', 'createRecurrenceHelperTool', 'POST', '/api/v1/calendar/recurrence-helper', 'calendar'],
  ['outlook_check_calendar_permissions', 'checkCalendarPermissionsTool', 'GET', '/api/v1/calendar/permissions/:calendarId', 'calendar'],

  ['outlook_list_folders', 'listFoldersTool', 'GET', '/api/v1/outlook/folders', 'folders'],
  ['outlook_create_folder', 'createFolderTool', 'POST', '/api/v1/outlook/folders', 'folders'],
  ['outlook_rename_folder', 'renameFolderTool', 'PATCH', '/api/v1/outlook/folders/:folderId', 'folders'],
  ['outlook_get_folder_stats', 'getFolderStatsTool', 'GET', '/api/v1/outlook/folders/:folderId/stats', 'folders'],

  ['outlook_list_attachments', 'listAttachmentsTool', 'GET', '/api/v1/outlook/messages/:messageId/attachments', 'attachments'],
  ['outlook_download_attachment', 'downloadAttachmentTool', 'GET', '/api/v1/outlook/messages/:messageId/attachments/:attachmentId', 'attachments'],
  ['outlook_add_attachment', 'addAttachmentTool', 'POST', '/api/v1/outlook/messages/:messageId/attachments', 'attachments'],
  ['outlook_scan_attachments', 'scanAttachmentsTool', 'GET', '/api/v1/outlook/attachments/scan', 'attachments'],

  ['outlook_get_sharepoint_file', 'getSharePointFileTool', 'GET', '/api/v1/sharepoint/file', 'sharepoint'],
  ['outlook_list_sharepoint_files', 'listSharePointFilesTool', 'GET', '/api/v1/sharepoint/files', 'sharepoint'],
  ['outlook_resolve_sharepoint_link', 'resolveSharePointLinkTool', 'GET', '/api/v1/sharepoint/resolve', 'sharepoint'],

  ['outlook_save_attachment', 'saveAttachmentTool', 'POST', '/api/v1/receipts/attachments/save', 'receipts'],
  ['outlook_fetch_billing_pdf', 'fetchBillingPdfTool', 'POST', '/api/v1/receipts/billing-pdf', 'receipts'],
  ['outlook_extract_receipt', 'extractReceiptTool', 'POST', '/api/v1/receipts/extract', 'receipts'],
  ['outlook_render_email_pdf', 'renderEmailPdfTool', 'POST', '/api/v1/receipts/render-email-pdf', 'receipts'],
  ['outlook_collect_receipts', 'collectReceiptsTool', 'POST', '/api/v1/receipts/collect', 'receipts'],
];

export const toolRegistry = specs.map(([name, exportName, method, path, category]) => ({
  name,
  exportName,
  method,
  path,
  category,
  handler: tools[exportName],
  schema: allToolSchemaMap[name],
}));

export const toolRegistryByName = new Map(toolRegistry.map(spec => [spec.name, spec]));