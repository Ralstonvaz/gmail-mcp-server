/**
 * MCP Tool: Read email using IMAP
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ImapClient } from '../email/imap-client.js';
import { formatEmailContent, formatJSONResponse } from '../utils/formatters.js';

const ReadEmailSchema = z.object({
  uid: z.number().int().describe('IMAP UID of the email to read'),
  mailbox: z.string().optional().describe('Mailbox to read from (default: INBOX)'),
});

export function createReadEmailTool(): Tool {
  return {
    name: 'gmail_read_email',
    description: 'Read full email content by IMAP UID. Returns subject, sender, recipients, body (text and HTML), attachments, and metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        uid: {
          type: 'number',
          description: 'IMAP UID of the email to read',
        },
        mailbox: {
          type: 'string',
          description: 'Mailbox to read from (default: INBOX)',
        },
      },
      required: ['uid'],
    },
    annotations: {
      readOnlyHint: true,
    },
  };
}

export async function handleReadEmail(
  imapClient: ImapClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const parsed = ReadEmailSchema.parse(args);
  
  const email = await imapClient.getEmail(parsed.uid, parsed.mailbox);
  
  const textSummary = formatEmailContent(email);
  const jsonData = formatJSONResponse(email);
  
  return {
    content: [
      { type: 'text', text: textSummary },
      { type: 'text', text: `\n\n--- JSON Data ---\n${jsonData}` },
    ],
  };
}

