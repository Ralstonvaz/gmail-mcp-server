/**
 * Response formatting utilities
 */

import type { EmailMessage } from '../email/types.js';

/**
 * Format email address for display
 */
function formatAddress(addr?: { name?: string; address: string }): string {
  if (!addr) return 'N/A';
  return addr.name ? `${addr.name} <${addr.address}>` : addr.address;
}

/**
 * Format email addresses array for display
 */
function formatAddresses(addrs?: Array<{ name?: string; address: string }>): string {
  if (!addrs || addrs.length === 0) return 'N/A';
  return addrs.map(formatAddress).join(', ');
}

/**
 * Format email message for display
 */
export function formatEmailSummary(email: EmailMessage): string {
  const parts: string[] = [];
  
  if (email.subject) parts.push(`Subject: ${email.subject}`);
  if (email.from) parts.push(`From: ${formatAddress(email.from)}`);
  if (email.to && email.to.length > 0) parts.push(`To: ${formatAddresses(email.to)}`);
  if (email.date) parts.push(`Date: ${email.date.toISOString()}`);
  if (email.unread) parts.push(`[UNREAD]`);
  parts.push(`UID: ${email.uid}`);
  
  if (email.body?.text) {
    const preview = email.body.text.substring(0, 100).replace(/\n/g, ' ');
    parts.push(`\nPreview: ${preview}...`);
  }
  
  return parts.join('\n');
}

/**
 * Format email list as text summary
 */
export function formatEmailList(emails: EmailMessage[]): string {
  if (emails.length === 0) {
    return 'No emails found.';
  }
  
  const summary = emails.map((email, index) => {
    return `\n${index + 1}. ${formatEmailSummary(email)}`;
  }).join('\n---\n');
  
  return `Found ${emails.length} email(s):\n${summary}`;
}

/**
 * Format email content for display
 */
export function formatEmailContent(email: EmailMessage): string {
  const parts: string[] = [];
  
  parts.push('='.repeat(60));
  if (email.subject) parts.push(`Subject: ${email.subject}`);
  if (email.from) parts.push(`From: ${formatAddress(email.from)}`);
  if (email.to && email.to.length > 0) parts.push(`To: ${formatAddresses(email.to)}`);
  if (email.cc && email.cc.length > 0) parts.push(`CC: ${formatAddresses(email.cc)}`);
  if (email.bcc && email.bcc.length > 0) parts.push(`BCC: ${formatAddresses(email.bcc)}`);
  if (email.replyTo && email.replyTo.length > 0) parts.push(`Reply-To: ${formatAddresses(email.replyTo)}`);
  if (email.date) parts.push(`Date: ${email.date.toISOString()}`);
  parts.push(`UID: ${email.uid}`);
  if (email.messageId) parts.push(`Message-ID: ${email.messageId}`);
  parts.push('='.repeat(60));
  
  if (email.body?.text) {
    parts.push('\n--- Plain Text Body ---\n');
    parts.push(email.body.text);
  }
  
  if (email.body?.html) {
    parts.push('\n--- HTML Body (stripped) ---\n');
    // Simple HTML stripping - in production, use a proper HTML parser
    parts.push(email.body.html.replace(/<[^>]*>/g, '').substring(0, 500));
  }
  
  if (email.attachments && email.attachments.length > 0) {
    parts.push('\n--- Attachments ---\n');
    email.attachments.forEach(att => {
      parts.push(`- ${att.filename} (${att.contentType}, ${att.size} bytes)`);
    });
  }
  
  return parts.join('\n');
}

/**
 * Format JSON response for MCP
 */
export function formatJSONResponse(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

