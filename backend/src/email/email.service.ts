import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * SMTP email sender. Configuration is read entirely from environment so the
 * same build points at maildev locally and relay1.dataart.com in the QA
 * environment — no SMTP secrets in source control.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST') ?? 'localhost';
    const port = Number(this.config.get<string>('SMTP_PORT') ?? '1025');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASSWORD');

    this.from =
      this.config.get<string>('SMTP_FROM') ??
      'Ticketing <no-reply@ticketing.local>';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
    });
  }

  async sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
    // nodemailer v9 ships no types and @types/nodemailer lags, so the result is
    // loosely typed; treat it as unknown and narrow before reading messageId.
    const info: unknown = await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Verify your email address',
      text:
        `Welcome to the Ticketing System.\n\n` +
        `Please verify your email address. This link is valid for 24 hours and ` +
        `can be used once:\n\n${verifyUrl}\n\n` +
        `If you did not create an account, you can ignore this message.`,
      html:
        `<p>Welcome to the Ticketing System.</p>` +
        `<p>Please verify your email address. This link is valid for 24 hours ` +
        `and can be used once:</p>` +
        `<p><a href="${verifyUrl}">${verifyUrl}</a></p>` +
        `<p>If you did not create an account, you can ignore this message.</p>`,
    });
    const messageId =
      info && typeof info === 'object' && 'messageId' in info
        ? String((info as Record<string, unknown>).messageId)
        : 'unknown';
    this.logger.log(
      `Verification email sent to ${to} (messageId: ${messageId})`,
    );
  }
}
