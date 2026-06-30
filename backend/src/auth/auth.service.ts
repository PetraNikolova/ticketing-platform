import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { randomBytes, createHash } from 'node:crypto';
import type { CookieOptions } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours, single-use.

export interface PublicUser {
  id: string;
  email: string;
  emailVerified: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  // ── Signup ─────────────────────────────────────────────────────────────
  async signup(dto: SignupDto): Promise<{ id: string; email: string }> {
    // DTO already trimmed + lowercased the email.
    const email = dto.email;

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    // @node-rs/argon2 defaults to Argon2id, the algorithm the spec calls for.
    const passwordHash = await hash(dto.password);

    const user = await this.prisma.user.create({
      data: { email, passwordHash },
    });

    await this.issueVerificationToken(user.id, user.email);
    return { id: user.id, email: user.email };
  }

  // ── Email verification ─────────────────────────────────────────────────
  async verify(rawToken: string | undefined): Promise<{ verified: true }> {
    if (!rawToken) {
      throw new BadRequestException('Verification token is missing');
    }

    const tokenHash = this.hashToken(rawToken);
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });

    if (!record) {
      throw new BadRequestException('Invalid verification link');
    }
    if (record.usedAt) {
      throw new BadRequestException(
        'This verification link has already been used',
      );
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('This verification link has expired');
    }

    // Single-use: consume the token and verify the user atomically.
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: true },
      }),
    ]);

    return { verified: true };
  }

  async resendVerification(email: string): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Do not reveal whether the email exists; only send when applicable.
    if (user && !user.emailVerified) {
      await this.issueVerificationToken(user.id, user.email);
    }
    return { ok: true };
  }

  // ── Login ──────────────────────────────────────────────────────────────
  async login(dto: LoginDto): Promise<{ token: string; user: PublicUser }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Uniform error to avoid leaking which emails are registered.
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const passwordOk = await verify(user.passwordHash, dto.password);
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.emailVerified) {
      throw new ForbiddenException(
        'Please verify your email address before logging in',
      );
    }

    const token = await this.jwt.signAsync({ sub: user.id });
    return { token, user: this.toPublicUser(user) };
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toPublicUser(user);
  }

  // ── Cookie helpers (used by the controller) ──────────────────────────────
  cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<string>('NODE_ENV') === 'production',
      path: '/',
      maxAge: this.sessionTtlMs(),
    };
  }

  cookieClearOptions(): CookieOptions {
    // Same attributes as the session cookie minus maxAge, so the browser
    // matches and removes it.
    const options = this.cookieOptions();
    delete options.maxAge;
    return options;
  }

  // ── Internals ────────────────────────────────────────────────────────────
  private async issueVerificationToken(
    userId: string,
    email: string,
  ): Promise<void> {
    // Issuing a new token invalidates earlier unused ones.
    await this.prisma.emailVerificationToken.deleteMany({
      where: { userId, usedAt: null },
    });

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

    await this.prisma.emailVerificationToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    const base = (
      this.config.get<string>('APP_BASE_URL') ?? 'http://localhost:5173'
    ).replace(/\/$/, '');
    const verifyUrl = `${base}/verify?token=${rawToken}`;
    await this.email.sendVerificationEmail(email, verifyUrl);
  }

  /** Only the hash of a verification token is stored; the raw token lives in the link. */
  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    emailVerified: boolean;
  }): PublicUser {
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
    };
  }

  private sessionTtlMs(): number {
    const ttl = this.config.get<string>('SESSION_TTL') ?? '7d';
    return AuthService.parseDurationMs(ttl);
  }

  /** Parses simple durations like "7d", "12h", "30m", "3600s", or raw ms. */
  static parseDurationMs(value: string): number {
    const match = /^(\d+)\s*([smhd])?$/.exec(value.trim());
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000; // safe default: 7 days
    }
    const amount = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return unit ? amount * multipliers[unit] : amount;
  }
}
