/**
 * MCP Tool: List emails using IMAP
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ImapClient } from '../email/imap-client.js';
import { formatEmailList, formatJSONResponse } from '../utils/formatters.js';

const ListEmailsSchema = z.object({
  limit: z.number().int().min(1).max(500).optional().describe('Maximum number of emails to return (default: 50, max: 500)'),
  offset: z.number().int().min(0).optional().describe('Offset for pagination (default: 0)'),
  mailbox: z.string().optional().describe('Mailbox to search in (default: INBOX)'),
  searchCriteria: z.array(z.string()).optional().describe('IMAP search criteria (e.g., ["UNSEEN", "FROM", "example@gmail.com"])'),
});

export function createListEmailsTool(_imapClient: ImapClient): Tool {
  return {
    name: 'gmail_list_emails',
    description: 'List recent emails using IMAP. Supports filtering by unread status, sender, date range, and more using IMAP search criteria.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of emails to return (default: 50, max: 500)',
          minimum: 1,
          maximum: 500,
        },
        offset: {
          type: 'number',
          description: 'Offset for pagination (default: 0)',
          minimum: 0,
        },
        mailbox: {
          type: 'string',
          description: 'Mailbox to search in (default: INBOX)',
        },
        searchCriteria: {
          type: 'array',
          items: { type: 'string' },
          description: 'IMAP search criteria (e.g., ["UNSEEN", "FROM", "example@gmail.com"])',
        },
      },
    },
    annotations: {
      readOnlyHint: true,
    },
  };
}

export async function handleListEmails(
  imapClient: ImapClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const parsed = ListEmailsSchema.parse(args);
  
  const searchCriteria = parsed.searchCriteria || ['ALL'];
  const emails = await imapClient.listEmails({
    limit: parsed.limit,
    offset: parsed.offset,
    mailbox: parsed.mailbox,
    searchCriteria,
  });
  
  const textSummary = formatEmailList(emails);
  const jsonData = formatJSONResponse({
    emails,
    count: emails.length,
  });
  
  return {
    content: [
      { type: 'text', text: textSummary },
      { type: 'text', text: `\n\n--- JSON Data ---\n${jsonData}` },
    ],
  };
}

