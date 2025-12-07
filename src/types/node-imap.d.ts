/**
 * Type definitions for node-imap
 */

declare module 'node-imap' {
  import { EventEmitter } from 'events';

  export interface Config {
    user: string;
    password: string;
    host?: string;
    port?: number;
    tls?: boolean;
    tlsOptions?: Record<string, unknown>;
    connTimeout?: number;
    authTimeout?: number;
    keepalive?: boolean | { interval?: number; idleInterval?: number; forceNoop?: boolean };
    debug?: (info: string) => void;
  }

  export interface Box {
    name: string;
    readOnly: boolean;
    newKeywords: boolean;
    uidvalidity: number;
    uidnext: number;
    flags: string[];
    permFlags: string[];
    persistentUIDs: boolean;
    messages: {
      total: number;
      new: number;
      unseen: number;
    };
  }

  export interface ImapMessage extends EventEmitter {
    on(event: 'body', listener: (stream: NodeJS.ReadableStream, info: { seqno: number; which: string; size: number }) => void): this;
    on(event: 'attributes', listener: (attrs: { uid: number; flags: string[]; date: Date; struct: any; size: number }) => void): this;
    on(event: 'end', listener: () => void): this;
    once(event: 'body', listener: (stream: NodeJS.ReadableStream, info: { seqno: number; which: string; size: number }) => void): this;
    once(event: 'attributes', listener: (attrs: { uid: number; flags: string[]; date: Date; struct: any; size: number }) => void): this;
    once(event: 'end', listener: () => void): this;
  }

  export interface ImapFetch extends EventEmitter {
    on(event: 'message', listener: (msg: ImapMessage, seqno: number) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    once(event: 'message', listener: (msg: ImapMessage, seqno: number) => void): this;
    once(event: 'error', listener: (err: Error) => void): this;
  }

  export default class Imap extends EventEmitter {
    constructor(config: Config);
    connect(): void;
    end(): void;
    openBox(mailboxName: string, openReadOnly: boolean, callback: (err: Error | null, box: Box) => void): void;
    search(criteria: any[], callback: (err: Error | null, uids: number[]) => void): void;
    fetch(source: number | number[] | { start: number; end: number }, options: {
      bodies?: string | string[];
      struct?: boolean;
    }): ImapFetch;
    addFlags(source: number | number[], flags: string | string[], callback: (err: Error | null) => void): void;
    delFlags(source: number | number[], flags: string | string[], callback: (err: Error | null) => void): void;
    setFlags(source: number | number[], flags: string | string[], callback: (err: Error | null) => void): void;
    on(event: 'ready', listener: () => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'end', listener: () => void): this;
    once(event: 'ready', listener: () => void): this;
    once(event: 'error', listener: (err: Error) => void): this;
    once(event: 'end', listener: () => void): this;
  }
}

