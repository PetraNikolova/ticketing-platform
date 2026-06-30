import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { EmailService } from './../src/email/email.service';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * Full authentication business flow (a backend integration test):
 * signup → blocked login (unverified) → verify → single-use re-verify rejected
 * → login → session-protected /me → unauthenticated /me rejected, plus the key
 * validation/conflict cases.
 *
 * EmailService is replaced with a stub that captures the verification link, so
 * the test is self-contained (no SMTP server required).
 */
describe('Auth flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // Unique email per run so repeated runs don't collide; cleaned up in afterAll.
  const email = `auth.e2e.${Date.now()}@example.com`;
  const password = 'sup3rsecret!';
  let capturedVerifyUrl = '';

  const emailStub: Partial<EmailService> = {
    sendVerificationEmail: (_to: string, verifyUrl: string) => {
      capturedVerifyUrl = verifyUrl;
      return Promise.resolve();
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue(emailStub)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    prisma = moduleFixture.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    // Clean up test data (tokens cascade on user delete).
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  const tokenFromUrl = (url: string): string => {
    const match = /[?&]token=([^&]+)/.exec(url);
    return match ? decodeURIComponent(match[1]) : '';
  };

  it('rejects signup with a too-short password (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({ email: `short.${Date.now()}@example.com`, password: 'short' })
      .expect(400);
  });

  it('signs up a new user (201) and sends a verification email', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({ email, password })
      .expect(201);

    expect(res.body.email).toBe(email);
    expect(capturedVerifyUrl).toContain('token=');
  });

  it('rejects duplicate signup (409)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({ email, password })
      .expect(409);
  });

  it('blocks login before verification (403)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(403);
  });

  it('verifies the email with the token (200)', async () => {
    const token = tokenFromUrl(capturedVerifyUrl);
    expect(token.length).toBeGreaterThan(0);

    const res = await request(app.getHttpServer())
      .get('/api/auth/verify')
      .query({ token })
      .expect(200);

    expect(res.body.verified).toBe(true);
  });

  it('rejects re-using the same verification token (400, single-use)', async () => {
    const token = tokenFromUrl(capturedVerifyUrl);
    await request(app.getHttpServer())
      .get('/api/auth/verify')
      .query({ token })
      .expect(400);
  });

  it('rejects login with a wrong password (401)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);
  });

  it('logs in after verification and sets a session cookie (200)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieHeader = Array.isArray(setCookie) ? setCookie.join(';') : '';
    expect(cookieHeader).toContain('session=');
    expect(cookieHeader.toLowerCase()).toContain('httponly');
  });

  it('rejects /me without a session cookie (401)', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('returns the current user from /me with the session cookie (200)', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    const cookie = login.headers['set-cookie'];

    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.email).toBe(email);
    expect(res.body.emailVerified).toBe(true);
  });
});
