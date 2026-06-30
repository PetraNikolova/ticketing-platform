import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { EmailService } from './../src/email/email.service';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * Comments business flow (backend integration test):
 * auth guard → comment on missing ticket 404 → blank body 400 → add two
 * comments → list oldest-first with author → adding a comment does not advance
 * the ticket's modifiedAt.
 *
 * EmailService is stubbed; a verified session is established via the real
 * signup → verify → login flow.
 */
describe('Comments flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cookie: string;
  let teamId: string;
  let ticketId: string;
  let ticketModifiedAt: string;

  const email = `comments.e2e.${Date.now()}@example.com`;
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

    await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({ email, password })
      .expect(201);
    const token = /[?&]token=([^&]+)/.exec(capturedVerifyUrl)?.[1] ?? '';
    await request(app.getHttpServer())
      .get('/api/auth/verify')
      .query({ token: decodeURIComponent(token) })
      .expect(200);
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    const setCookie = login.headers['set-cookie'];
    cookie = Array.isArray(setCookie)
      ? setCookie.join('; ')
      : String(setCookie);

    const team = await request(app.getHttpServer())
      .post('/api/teams')
      .set('Cookie', cookie)
      .send({ name: `Comments team ${Date.now()}` })
      .expect(201);
    teamId = team.body.id as string;

    const ticket = await request(app.getHttpServer())
      .post('/api/tickets')
      .set('Cookie', cookie)
      .send({ teamId, type: 'feature', title: 'Commented', body: 'body' })
      .expect(201);
    ticketId = ticket.body.id as string;
    ticketModifiedAt = ticket.body.modifiedAt as string;
  });

  afterAll(async () => {
    // Leave the database clean (DoD). Comments cascade with the ticket.
    await prisma.ticket.deleteMany({ where: { teamId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  const commentsUrl = (id: string) => `/api/tickets/${id}/comments`;

  it('rejects unauthenticated access (401)', async () => {
    await request(app.getHttpServer()).get(commentsUrl(ticketId)).expect(401);
  });

  it('returns 404 when commenting on a non-existent ticket', async () => {
    await request(app.getHttpServer())
      .post(commentsUrl('00000000-0000-0000-0000-000000000000'))
      .set('Cookie', cookie)
      .send({ body: 'orphan' })
      .expect(404);
  });

  it('rejects a blank comment body (400)', async () => {
    await request(app.getHttpServer())
      .post(commentsUrl(ticketId))
      .set('Cookie', cookie)
      .send({ body: '   ' })
      .expect(400);
  });

  it('adds comments and lists them oldest-first with author (200)', async () => {
    const first = await request(app.getHttpServer())
      .post(commentsUrl(ticketId))
      .set('Cookie', cookie)
      .send({ body: '  first comment  ' })
      .expect(201);
    expect(first.body.body).toBe('first comment'); // trimmed
    expect(first.body.author.email).toBe(email);

    await request(app.getHttpServer())
      .post(commentsUrl(ticketId))
      .set('Cookie', cookie)
      .send({ body: 'second comment' })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get(commentsUrl(ticketId))
      .set('Cookie', cookie)
      .expect(200);

    expect(list.body).toHaveLength(2);
    expect(list.body[0].body).toBe('first comment');
    expect(list.body[1].body).toBe('second comment');
    expect(list.body[0].author.email).toBe(email);
  });

  it('does not change the ticket modifiedAt when a comment is added', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/tickets/${ticketId}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body.modifiedAt).toBe(ticketModifiedAt);
  });
});
