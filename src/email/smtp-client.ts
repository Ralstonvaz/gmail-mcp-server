/**
 * SMTP Client for sending emails via Gmail
 */

import nodemailer, { Transporter, SentMessageInfo } from 'nodemailer';
import type { SendEmailOptions, ReplyEmailOptions } from './types.js';
import { GmailMCPError, withRetry } from '../utils/errors.js';

export interface SmtpConfig {
  user: string;
  password: string;
  host?: string;
  port?: number;
  secure?: boolean;
}

export class SmtpClient {
  private transporter: Transporter;
  private config: SmtpConfig;

  constructor(config: SmtpConfig) {
    this.config = {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // Use TLS
      ...config,
    };

    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.user,
        pass: this.config.password,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  /**
   * Verify SMTP connection
   */
  async verify(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.transporter.verify((error) => {
        if (error) {
          reject(new GmailMCPError(`SMTP verification failed: ${error.message}`, 'SMTP_ERROR'));
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Send email
   */
  async sendEmail(options: SendEmailOptions): Promise<string> {
    const {
      to,
      subject,
      body,
      htmlBody,
      cc,
      bcc,
      replyTo,
      attachments,
      inReplyTo,
      references,
    } = options;

    if (!to || !subject || (!body && !htmlBody)) {
      throw new GmailMCPError('to, subject, and body (or htmlBody) are required', 'VALIDATION_ERROR');
    }

    return withRetry(async () => {
      const toArray = Array.isArray(to) ? to : [to];
      const ccArray = cc ? (Array.isArray(cc) ? cc : [cc]) : undefined;
      const bccArray = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined;
      const replyToArray = replyTo ? (Array.isArray(replyTo) ? replyTo : [replyTo]) : undefined;
      const referencesArray = references
        ? (Array.isArray(references) ? references : [references])
        : undefined;

      const mailOptions: nodemailer.SendMailOptions = {
        from: this.config.user,
        to: toArray,
        subject,
        text: body,
        html: htmlBody,
        cc: ccArray,
        bcc: bccArray,
        replyTo: replyToArray,
        inReplyTo,
        references: referencesArray?.join(' '),
        attachments: attachments?.map(att => ({
          filename: att.filename,
          path: att.path,
          content: att.content,
          contentType: att.contentType,
        })),
      };

      try {
        const info: SentMessageInfo = await this.transporter.sendMail(mailOptions);
        return info.messageId || '';
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new GmailMCPError(`Failed to send email: ${errorMessage}`, 'SMTP_ERROR');
      }
    });
  }

  /**
   * Reply to email
   */
  async replyEmail(options: ReplyEmailOptions, originalEmail: {
    from?: { address: string };
    subject?: string;
    messageId?: string;
    references?: string[];
  }): Promise<string> {
    const {
      subject: replySubject,
      body,
      htmlBody,
      cc,
      bcc,
    } = options;

    if (!body && !htmlBody) {
      throw new GmailMCPError('Either body or htmlBody must be provided', 'VALIDATION_ERROR');
    }

    const subject = replySubject.startsWith('Re:') || originalEmail.subject?.startsWith('Re:')
      ? replySubject
      : `Re: ${originalEmail.subject || replySubject}`;

    const references = originalEmail.references
      ? [...originalEmail.references, originalEmail.messageId].filter(Boolean).join(' ')
      : originalEmail.messageId;

    return this.sendEmail({
      to: originalEmail.from?.address || '',
      subject,
      body,
      htmlBody,
      cc,
      bcc,
      inReplyTo: originalEmail.messageId,
      references,
    });
  }

  /**
   * Close SMTP connection
   */
  async close(): Promise<void> {
    this.transporter.close();
  }
}

