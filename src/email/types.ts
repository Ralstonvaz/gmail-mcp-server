/**
 * TypeScript types for IMAP/SMTP email integration
 */

export interface EmailMessage {
  uid: number;
  messageId?: string;
  subject?: string;
  from?: EmailAddress;
  to?: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  replyTo?: EmailAddress[];
  date?: Date;
  flags?: string[];
  labels?: string[];
  unread: boolean;
  body: {
    text?: string;
    html?: string;
  };
  attachments?: EmailAttachment[];
  headers: Record<string, string | string[]>;
  threadId?: string;
}

export interface EmailAddress {
  name?: string;
  address: string;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  contentId?: string;
  checksum?: string;
}

export interface EmailListOptions {
  limit?: number;
  offset?: number;
  searchCriteria?: (string | string[])[];
  mailbox?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  body?: string;
  htmlBody?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string | string[];
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: string | Buffer;
    contentType?: string;
  }>;
  inReplyTo?: string;
  references?: string | string[];
}

export interface ReplyEmailOptions {
  originalUid: number;
  originalMessageId: string;
  subject: string;
  body?: string;
  htmlBody?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

export interface SearchOptions {
  criteria: (string | string[])[];
  mailbox?: string;
  limit?: number;
}

