/**
 * IMAP Client for reading emails from Gmail
 */

import Imap from 'node-imap';
import { simpleParser, ParsedMail } from 'mailparser';
import type { EmailMessage, EmailListOptions, SearchOptions, EmailAddress } from './types.js';
import { GmailMCPError, NotFoundError, withRetry } from '../utils/errors.js';

export interface ImapConfig {
  user: string;
  password: string;
  host?: string;
  port?: number;
  tls?: boolean;
  tlsOptions?: Record<string, unknown>;
}

export class ImapClient {
  private imap: Imap | null = null;
  private config: ImapConfig;
  private connected: boolean = false;

  constructor(config: ImapConfig) {
    this.config = {
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      ...config,
    };
  }

  /**
   * Connect to IMAP server
   */
  async connect(): Promise<void> {
    if (this.connected && this.imap) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.imap = new Imap({
        user: this.config.user,
        password: this.config.password,
        host: this.config.host,
        port: this.config.port,
        tls: this.config.tls,
        tlsOptions: this.config.tlsOptions,
      });

      this.imap.once('ready', () => {
        this.connected = true;
        resolve();
      });

      this.imap.once('error', (err: Error) => {
        this.connected = false;
        reject(new GmailMCPError(`IMAP connection error: ${err.message}`, 'IMAP_ERROR'));
      });

      this.imap.once('end', () => {
        this.connected = false;
      });

      this.imap.connect();
    });
  }

  /**
   * Disconnect from IMAP server
   */
  async disconnect(): Promise<void> {
    if (this.imap && this.connected) {
      return new Promise((resolve) => {
        this.imap!.end();
        this.imap!.once('end', () => {
          this.connected = false;
          this.imap = null;
          resolve();
        });
      });
    }
  }

  /**
   * Open mailbox
   */
  private async openMailbox(mailbox: string = 'INBOX'): Promise<void> {
    if (!this.imap || !this.connected) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      if (!this.imap) {
        reject(new GmailMCPError('IMAP client not initialized', 'IMAP_ERROR'));
        return;
      }

      this.imap.openBox(mailbox, false, (err) => {
        if (err) {
          reject(new GmailMCPError(`Failed to open mailbox: ${err.message}`, 'IMAP_ERROR'));
          return;
        }
        resolve();
      });
    });
  }

  /**
   * List emails
   */
  async listEmails(options: EmailListOptions = {}): Promise<EmailMessage[]> {
    const {
      limit = 50,
      offset = 0,
      searchCriteria = ['ALL'],
      mailbox = 'INBOX',
    } = options;

    return withRetry(async () => {
      await this.openMailbox(mailbox);

      return new Promise((resolve, reject) => {
        if (!this.imap) {
          reject(new GmailMCPError('IMAP client not initialized', 'IMAP_ERROR'));
          return;
        }

        this.imap.search(searchCriteria, (err, results) => {
          if (err) {
            reject(new GmailMCPError(`IMAP search error: ${err.message}`, 'IMAP_ERROR'));
            return;
          }

          if (!results || results.length === 0) {
            resolve([]);
            return;
          }

          // Reverse to get newest first, then apply offset and limit
          const uids = results.reverse().slice(offset, offset + limit);

          if (uids.length === 0) {
            resolve([]);
            return;
          }

          const fetch = this.imap!.fetch(uids, {
            bodies: '',
            struct: true,
          });

          const emails: EmailMessage[] = [];
          let processed = 0;

          fetch.on('message', (msg) => {
            let uid: number | null = null;
            let flags: string[] = [];
            let headers = '';

            msg.on('body', (stream) => {
              let buffer = '';
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });
              stream.on('end', () => {
                headers = buffer;
              });
            });

            msg.once('attributes', (attrs) => {
              uid = attrs.uid;
              flags = attrs.flags || [];
            });

            msg.once('end', async () => {
              if (uid === null) {
                processed++;
                if (processed === uids.length) {
                  resolve(emails);
                }
                return;
              }

              try {
                const parsed = await simpleParser(headers);
                const email = this.parseEmail(parsed, uid, flags);
                emails.push(email);
              } catch (parseErr) {
                console.error(`Error parsing email ${uid}:`, parseErr);
              }

              processed++;
              if (processed === uids.length) {
                resolve(emails);
              }
            });
          });

          fetch.once('error', (err) => {
            reject(new GmailMCPError(`IMAP fetch error: ${err.message}`, 'IMAP_ERROR'));
          });
        });
      });
    });
  }

  /**
   * Get email by UID
   */
  async getEmail(uid: number, mailbox: string = 'INBOX'): Promise<EmailMessage> {
    return withRetry(async () => {
      await this.openMailbox(mailbox);

      return new Promise((resolve, reject) => {
        if (!this.imap) {
          reject(new GmailMCPError('IMAP client not initialized', 'IMAP_ERROR'));
          return;
        }

        const fetch = this.imap.fetch([uid], {
          bodies: '',
          struct: true,
        });

        let email: EmailMessage | null = null;

        fetch.on('message', (msg) => {
          let flags: string[] = [];
          let headers = '';

          msg.on('body', (stream) => {
            let buffer = '';
            stream.on('data', (chunk) => {
              buffer += chunk.toString('utf8');
            });
            stream.on('end', () => {
              headers = buffer;
            });
          });

          msg.once('attributes', (attrs) => {
            flags = attrs.flags || [];
          });

          msg.once('end', async () => {
            try {
              const parsed = await simpleParser(headers);
              email = this.parseEmail(parsed, uid, flags);
              resolve(email);
            } catch (parseErr) {
              reject(new GmailMCPError(`Error parsing email: ${parseErr instanceof Error ? parseErr.message : 'Unknown error'}`, 'IMAP_ERROR'));
            }
          });
        });

        fetch.once('error', (err) => {
          if (err.message.includes('not found')) {
            reject(new NotFoundError(`Email with UID ${uid}`));
          } else {
            reject(new GmailMCPError(`IMAP fetch error: ${err.message}`, 'IMAP_ERROR'));
          }
        });
      });
    });
  }

  /**
   * Search emails
   */
  async searchEmails(options: SearchOptions): Promise<EmailMessage[]> {
    const {
      criteria,
      mailbox = 'INBOX',
      limit = 50,
    } = options;

    return this.listEmails({
      searchCriteria: criteria,
      mailbox,
      limit,
    });
  }

  /**
   * Mark email as read
   */
  async markAsRead(uids: number[], mailbox: string = 'INBOX'): Promise<void> {
    return withRetry(async () => {
      await this.openMailbox(mailbox);

      return new Promise((resolve, reject) => {
        if (!this.imap) {
          reject(new GmailMCPError('IMAP client not initialized', 'IMAP_ERROR'));
          return;
        }

        this.imap.addFlags(uids, '\\Seen', (err) => {
          if (err) {
            reject(new GmailMCPError(`Failed to mark as read: ${err.message}`, 'IMAP_ERROR'));
            return;
          }
          resolve();
        });
      });
    });
  }

  /**
   * Parse ParsedMail to EmailMessage
   */
  private parseEmail(parsed: ParsedMail, uid: number, flags: string[]): EmailMessage {
    const unread = !flags.includes('\\Seen');

    const parseAddress = (addr: any): EmailAddress | undefined => {
      if (!addr) return undefined;
      if (Array.isArray(addr)) {
        return addr.length > 0 ? {
          name: addr[0].name,
          address: addr[0].address,
        } : undefined;
      }
      return {
        name: addr.name,
        address: addr.address,
      };
    };

    const parseAddresses = (addrs: any): EmailAddress[] | undefined => {
      if (!addrs) return undefined;
      const addresses = Array.isArray(addrs) ? addrs : [addrs];
      return addresses.map(addr => ({
        name: addr.name,
        address: addr.address,
      }));
    };

    const attachments: EmailMessage['attachments'] = parsed.attachments?.map((att: any) => ({
      filename: att.filename || 'unnamed',
      contentType: att.contentType || 'application/octet-stream',
      size: att.size || 0,
      contentId: att.contentId,
      checksum: att.checksum,
    }));

    return {
      uid,
      messageId: parsed.messageId,
      subject: parsed.subject,
      from: parseAddress(parsed.from),
      to: parseAddresses(parsed.to),
      cc: parseAddresses(parsed.cc),
      bcc: parseAddresses(parsed.bcc),
      replyTo: parseAddresses(parsed.replyTo),
      date: parsed.date,
      flags,
      unread,
      body: {
        text: parsed.text || undefined,
        html: parsed.html || undefined,
      },
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
      headers: Object.fromEntries(
        Array.from(parsed.headers.entries()).map(([key, value]) => [
          key,
          Array.isArray(value) ? value : [value],
        ])
      ) as Record<string, string | string[]>,
      threadId: parsed.inReplyTo || parsed.references?.[0],
    };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

