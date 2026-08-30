/**
 * Mail transport for the "email me the STL" endpoint.
 *
 * The send is deliberately behind a tiny interface with a real SMTP
 * implementation (via nodemailer, lazy-loaded) that activates only when
 * `SMTP_URL` is set. With no transport configured the endpoint reports
 * 501 rather than pretending to have sent anything — you supply your own mail
 * provider's SMTP credentials via env; this repo never signs up for one.
 */

export interface Attachment {
  filename: string;
  content: Uint8Array;
  contentType: string;
}

export interface Mailer {
  readonly configured: boolean;
  send(to: string, subject: string, text: string, attachments: Attachment[]): Promise<void>;
}

class SmtpMailer implements Mailer {
  readonly configured = true;
  constructor(
    private url: string,
    private from: string,
  ) {}

  async send(to: string, subject: string, text: string, attachments: Attachment[]): Promise<void> {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport(this.url);
    await transport.sendMail({
      from: this.from,
      to,
      subject,
      text,
      attachments: attachments.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content),
        contentType: a.contentType,
      })),
    });
  }
}

class NullMailer implements Mailer {
  readonly configured = false;
  async send(): Promise<void> {
    throw new Error(
      "No mail transport configured. Set SMTP_URL (e.g. smtps://user:pass@smtp.example.com) and MAIL_FROM.",
    );
  }
}

export function getMailer(): Mailer {
  const url = process.env.SMTP_URL;
  if (!url) return new NullMailer();
  return new SmtpMailer(url, process.env.MAIL_FROM ?? "packout-designer@localhost");
}
