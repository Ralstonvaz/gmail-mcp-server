/**
 * MCP Tool: Reply to email using SMTP
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ImapClient } from '../email/imap-client.js';
import type { SmtpClient } from '../email/smtp-client.js';

const ReplyEmailSchema = z.object({
  originalUid: z.number().int().describe('IMAP UID of the email to reply to'),
  subject: z.string().optional().describe('Reply subject (defaults to "Re: <original subject>")'),
  body: z.string().optional().describe('Plain text reply body'),
  htmlBody: z.string().optional().describe('HTML reply body (alternative to body)'),
  cc: z.union([z.string(), z.array(z.string())]).optional().describe('CC recipient email address(es)'),
  bcc: z.union([z.string(), z.array(z.string())]).optional().describe('BCC recipient email address(es)'),
  mailbox: z.string().optional().describe('Mailbox where original email is located (default: INBOX)'),
});

export function createReplyEmailTool(): Tool {
  return {
    name: 'gmail_reply_email',
    description: 'Reply to a specific email. Automatically sets In-Reply-To and References headers, and prefixes subject with "Re:".',
    inputSchema: {
      type: 'object',
      properties: {
        originalUid: {
          type: 'number',
          description: 'IMAP UID of the email to reply to',
        },
        subject: {
          type: 'string',
          description: 'Reply subject (defaults to "Re: <original subject>")',
        },
        body: {
          type: 'string',
          description: 'Plain text reply body',
        },
        htmlBody: {
          type: 'string',
          description: 'HTML reply body (alternative to body)',
        },
        cc: {
          type: ['string', 'array'],
          items: { type: 'string' },
          description: 'CC recipient email address(es)',
        },
        bcc: {
          type: ['string', 'array'],
          items: { type: 'string' },
          description: 'BCC recipient email address(es)',
        },
        mailbox: {
          type: 'string',
          description: 'Mailbox where original email is located (default: INBOX)',
        },
      },
      required: ['originalUid'],
    },
    annotations: {
      destructiveHint: false,
    },
  };
}

export async function handleReplyEmail(
  imapClient: ImapClient,
  smtpClient: SmtpClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const parsed = ReplyEmailSchema.parse(args);
  
  if (!parsed.body && !parsed.htmlBody) {
    throw new Error('Either body or htmlBody must be provided');
  }
  
  // Get original email
  const originalEmail = await imapClient.getEmail(parsed.originalUid, parsed.mailbox);
  
  const replySubject = parsed.subject || (originalEmail.subject
    ? (originalEmail.subject.startsWith('Re:') ? originalEmail.subject : `Re: ${originalEmail.subject}`)
    : 'Re: (no subject)');
  
  const messageId = await smtpClient.replyEmail({
    originalUid: parsed.originalUid,
    originalMessageId: originalEmail.messageId || '',
    subject: replySubject,
    body: parsed.body,
    htmlBody: parsed.htmlBody,
    cc: parsed.cc,
    bcc: parsed.bcc,
  }, {
    from: originalEmail.from,
    subject: originalEmail.subject,
    messageId: originalEmail.messageId,
    references: originalEmail.headers.references
      ? (Array.isArray(originalEmail.headers.references)
          ? originalEmail.headers.references
          : [originalEmail.headers.references])
      : undefined,
  });
  
  return {
    content: [
      {
        type: 'text',
        text: `✅ Reply sent successfully!\n\nMessage ID: ${messageId}\nOriginal UID: ${parsed.originalUid}\nSubject: ${replySubject}`,
      },
    ],
  };
}

