/**
 * MCP Tool: Search emails using IMAP
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ImapClient } from '../email/imap-client.js';
import { formatEmailList, formatJSONResponse } from '../utils/formatters.js';

const SearchEmailsSchema = z.object({
  criteria: z.array(z.string()).describe('IMAP search criteria (e.g., ["UNSEEN", "FROM", "example@gmail.com"] or ["SINCE", "01-Jan-2024"])'),
  mailbox: z.string().optional().describe('Mailbox to search in (default: INBOX)'),
  limit: z.number().int().min(1).max(500).optional().describe('Maximum number of results to return (default: 50, max: 500)'),
});

export function createSearchEmailsTool(): Tool {
  return {
    name: 'gmail_search_emails',
    description: 'Search emails using IMAP search criteria. Supports UNSEEN, FROM, TO, SUBJECT, SINCE, BEFORE, and more.',
    inputSchema: {
      type: 'object',
      properties: {
        criteria: {
          type: 'array',
          items: { type: 'string' },
          description: 'IMAP search criteria (e.g., ["UNSEEN", "FROM", "example@gmail.com"] or ["SINCE", "01-Jan-2024"])',
        },
        mailbox: {
          type: 'string',
          description: 'Mailbox to search in (default: INBOX)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 50, max: 500)',
          minimum: 1,
          maximum: 500,
        },
      },
      required: ['criteria'],
    },
    annotations: {
      readOnlyHint: true,
    },
  };
}

export async function handleSearchEmails(
  imapClient: ImapClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const parsed = SearchEmailsSchema.parse(args);
  
  const emails = await imapClient.searchEmails({
    criteria: parsed.criteria,
    mailbox: parsed.mailbox,
    limit: parsed.limit,
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

