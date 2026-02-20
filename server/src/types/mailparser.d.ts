declare module 'mailparser' {
  import { Readable } from 'stream';

  export interface ParsedMail {
    from?: { value: Array<{ address?: string; name?: string }> };
    subject?: string;
    text?: string;
    html?: string;
    headers?: Map<string, string | string[]>;
    attachments?: Array<{ filename?: string; content: Buffer; contentType?: string }>;
  }

  export function simpleParser(input: Buffer | Readable): Promise<ParsedMail>;
}
