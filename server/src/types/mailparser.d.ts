declare module 'mailparser' {
  import { Readable } from 'stream';
  export function simpleParser(input: Buffer | Readable): Promise<{
    text?: string;
    html?: string;
    attachments?: Array<{ filename?: string; content: Buffer; contentType?: string }>;
  }>;
}
