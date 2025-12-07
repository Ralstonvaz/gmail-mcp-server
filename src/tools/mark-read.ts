/**
 * MCP Tool: Mark emails as read using IMAP
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ImapClient } from '../email/imap-client.js';

const MarkReadSchema = z.object({
  uids: z.array(z.number().int()).min(1).describe('Array of IMAP UIDs to mark as read'),
  mailbox: z.string().optional().describe('Mailbox where emails are located (default: INBOX)'),
});

export function createMarkReadTool(): Tool {
  return {
    name: 'gmail_mark_read',
    description: 'Mark one or more emails as read by removing the UNSEEN flag. Accepts an array of IMAP UIDs.',
    inputSchema: {
      type: 'object',
      properties: {
        uids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of IMAP UIDs to mark as read',
          minItems: 1,
        },
        mailbox: {
          type: 'string',
          description: 'Mailbox where emails are located (default: INBOX)',
        },
      },
      required: ['uids'],
    },
  };
}

export async function handleMarkRead(
  imapClient: ImapClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const parsed = MarkReadSchema.parse(args);
  
  await imapClient.markAsRead(parsed.uids, parsed.mailbox);
  
  return {
    content: [
      {
        type: 'text',
        text: `✅ Marked ${parsed.uids.length} email(s) as read.\n\nUIDs: ${parsed.uids.join(', ')}`,
      },
    ],
  };
}
