/**
 * Send email using a react_EmailSettings config (SMTP or API).
 */

import nodemailer from 'nodemailer';
import type { EmailSettingPayload } from './emailSettingsService';

export interface SendMailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  attachments?: SendMailAttachment[];
}

function toArray(addr: string | string[]): string[] {
  return Array.isArray(addr) ? addr : [addr];
}

export async function sendMail(config: EmailSettingPayload, options: SendMailOptions): Promise<void> {
  const toList = toArray(options.to);
  if (toList.length === 0) throw new Error('At least one recipient required');
  if (!config.isActive) throw new Error('Email config is not active');

  if (config.type === 'smtp') {
    await sendViaSmtp(config, options);
  } else if (config.type === 'api') {
    if (options.attachments?.length) throw new Error('Email attachments are not supported with API provider; use SMTP for audit report emails.');
    await sendViaApi(config, options);
  } else {
    throw new Error('Unknown email config type: ' + config.type);
  }
}

async function sendViaSmtp(config: EmailSettingPayload, options: SendMailOptions): Promise<void> {
  const host = config.smtpHost?.trim();
  if (!host) throw new Error('SMTP host is required');
  const port = config.smtpPort ?? (config.smtpSecure ? 465 : 587);
  const secure = config.smtpSecure ?? (port === 465);
  const transporter = nodemailer.createTransport({
    host,
    port: Number(port),
    secure,
    auth: config.smtpUsername
      ? { user: config.smtpUsername, pass: config.smtpPassword || undefined }
      : undefined,
  });
  const toList = toArray(options.to);
  const mailOptions: Parameters<typeof transporter.sendMail>[0] = {
    from: config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail,
    to: toList.join(', '),
    replyTo: options.replyTo,
    subject: options.subject,
    text: options.text ?? undefined,
    html: options.html ?? undefined,
  };
  if (options.attachments?.length) {
    mailOptions.attachments = options.attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    }));
  }
  await transporter.sendMail(mailOptions);
}

async function sendViaApi(config: EmailSettingPayload, options: SendMailOptions): Promise<void> {
  const provider = (config.apiProvider || 'custom').toLowerCase();
  const apiKey = config.apiKey;
  const fromEmail = config.fromEmail;
  const fromName = config.fromName || fromEmail;
  const toList = toArray(options.to);

  if (provider === 'sendgrid') {
    if (!apiKey) throw new Error('SendGrid API key is required');
    const url = 'https://api.sendgrid.com/v3/mail/send';
    const body = {
      personalizations: [{ to: toList.map((email) => ({ email })) }],
      from: { email: fromEmail, name: fromName },
      subject: options.subject,
      content: [
        ...(options.text ? [{ type: 'text/plain', value: options.text }] : []),
        ...(options.html ? [{ type: 'text/html', value: options.html }] : []),
      ].filter(Boolean) as { type: string; value: string }[],
    };
    if (body.content.length === 0) body.content = [{ type: 'text/plain', value: options.subject || '(No body)' }];
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error('SendGrid error: ' + (err || res.statusText));
    }
    return;
  }

  if (provider === 'mailgun') {
    if (!apiKey) throw new Error('Mailgun API key is required');
    const domain = config.apiDomain?.trim() || fromEmail.split('@')[1];
    if (!domain) throw new Error('Mailgun domain is required (set Api Domain or use From address domain)');
    const url = `https://api.mailgun.net/v3/${domain}/messages`;
    const form = new FormData();
    form.append('from', fromName ? `${fromName} <${fromEmail}>` : fromEmail);
    toList.forEach((t) => form.append('to', t));
    form.append('subject', options.subject);
    if (options.text) form.append('text', options.text);
    if (options.html) form.append('html', options.html);
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + Buffer.from('api:' + apiKey).toString('base64') },
      body: form,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error('Mailgun error: ' + (err || res.statusText));
    }
    return;
  }

  if (provider === 'custom' && config.apiUrl) {
    const url = config.apiUrl.trim();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: 'Bearer ' + apiKey } : {}),
      },
      body: JSON.stringify({
        from: fromEmail,
        fromName,
        to: toList,
        subject: options.subject,
        text: options.text,
        html: options.html,
      }),
    });
    if (!res.ok) throw new Error('Custom API error: ' + res.statusText);
    return;
  }

  throw new Error('API provider not configured (need ApiUrl for custom)');
}
