/**
 * MCP Tool: Send email using SMTP
 */

import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { SmtpClient } from '../email/smtp-client.js';

const SendEmailSchema = z.object({
  to: z.union([z.string(), z.array(z.string())]).describe('Recipient email address(es)'),
  subject: z.string().describe('Email subject line'),
  body: z.string().optional().describe('Plain text email body'),
  htmlBody: z.string().optional().describe('HTML email body (alternative to body)'),
  cc: z.union([z.string(), z.array(z.string())]).optional().describe('CC recipient email address(es)'),
  bcc: z.union([z.string(), z.array(z.string())]).optional().describe('BCC recipient email address(es)'),
  replyTo: z.union([z.string(), z.array(z.string())]).optional().describe('Reply-To email address(es)'),
  attachments: z.array(z.object({
    filename: z.string(),
    path: z.string().optional(),
    content: z.union([z.string(), z.instanceof(Buffer)]).optional(),
    contentType: z.string().optional(),
  })).optional().describe('Email attachments'),
});

export function createSendEmailTool(): Tool {
  return {
    name: 'gmail_send_email',
    description: 'Send a new email via SMTP. Supports CC, BCC, HTML body, and attachments.',
    inputSchema: {
      type: 'object',
      properties: {
        to: {
          type: ['string', 'array'],
          items: { type: 'string' },
          description: 'Recipient email address(es)',
        },
        subject: {
          type: 'string',
          description: 'Email subject line',
        },
        body: {
          type: 'string',
          description: 'Plain text email body',
        },
        htmlBody: {
          type: 'string',
          description: 'HTML email body (alternative to body)',
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
        replyTo: {
          type: ['string', 'array'],
          items: { type: 'string' },
          description: 'Reply-To email address(es)',
        },
        attachments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              filename: { type: 'string' },
              path: { type: 'string' },
              content: { type: ['string', 'object'] },
              contentType: { type: 'string' },
            },
            required: ['filename'],
          },
          description: 'Email attachments',
        },
      },
      required: ['to', 'subject'],
    },
    annotations: {
      destructiveHint: false,
      idempotentHint: false,
    },
  };
}

export async function handleSendEmail(
  smtpClient: SmtpClient,
  args: unknown
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const parsed = SendEmailSchema.parse(args);
  
  if (!parsed.body && !parsed.htmlBody) {
    throw new Error('Either body or htmlBody must be provided');
  }
  
  const messageId = await smtpClient.sendEmail({
    to: parsed.to,
    subject: parsed.subject,
    body: parsed.body,
    htmlBody: parsed.htmlBody,
    cc: parsed.cc,
    bcc: parsed.bcc,
    replyTo: parsed.replyTo,
    attachments: parsed.attachments,
  });
  
  const toStr = Array.isArray(parsed.to) ? parsed.to.join(', ') : parsed.to;
  const subjectStr = parsed.subject;
  
  return {
    content: [
      {
        type: 'text',
        text: `✅ Email sent successfully!\n\nMessage ID: ${messageId}\nTo: ${toStr}\nSubject: ${subjectStr}`,
      },
    ],
  };
}

