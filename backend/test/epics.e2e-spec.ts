import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { EmailService } from './../src/email/email.service';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * Epics CRUD business flow (backend integration test):
 * auth guard → create (with optional description) → list by team → blank-title
 * 400 → bad-team 400 → immutable-team 400 → no-op keeps modifiedAt → rename →
 * clear description → delete-while-referenced (409) → delete (204).
 *
 * EmailService is stubbed so signup is self-contained; a verified session is
 * established through the real signup → verify → login flow.
 */
describe('Epics flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cookie: string;
  let userId: string;
  let teamId: string;
  let epicId: string;

  const email = `epics.e2e.${Date.now()}@example.com`;
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

    // Verified session via the public auth flow.
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

    const user = await prisma.user.findUnique({ where: { email } });
    userId = user!.id;

    const team = await prisma.team.create({
      data: { name: `Epics team ${Date.now()}` },
    });
    teamId = team.id;
  });

  afterAll(async () => {
    // Leave the database clean (DoD).
    await prisma.ticket.deleteMany({ where: { teamId } });
    await prisma.epic.deleteMany({ where: { teamId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('rejects unauthenticated access to epics (401)', async () => {
    await request(app.getHttpServer()).get('/api/epics').expect(401);
  });

  it('creates an epic (201), trimming title and keeping description', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/epics')
      .set('Cookie', cookie)
      .send({ teamId, title: '  Checkout flow  ', description: '  v1  ' })
      .expect(201);

    expect(res.body.title).toBe('Checkout flow');
    expect(res.body.description).toBe('v1');
    expect(res.body.teamId).toBe(teamId);
    epicId = res.body.id as string;
  });

  it('lists epics filtered by team (200)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/epics')
      .query({ teamId })
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.some((e: { id: string }) => e.id === epicId)).toBe(true);
  });

  it('rejects a blank title (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/epics')
      .set('Cookie', cookie)
      .send({ teamId, title: '   ' })
      .expect(400);
  });

  it('rejects an epic referencing a non-existent team (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/epics')
      .set('Cookie', cookie)
      .send({
        teamId: '00000000-0000-0000-0000-000000000000',
        title: 'Orphan',
      })
      .expect(400);
  });

  it('rejects attempting to change the team on update (400, immutable)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/epics/${epicId}`)
      .set('Cookie', cookie)
      .send({ teamId: '00000000-0000-0000-0000-000000000000' })
      .expect(400);
  });

  it('does not advance modifiedAt on a no-op update', async () => {
    const before = await request(app.getHttpServer())
      .get('/api/epics')
      .query({ teamId })
      .set('Cookie', cookie)
      .expect(200);
    const original = before.body.find(
      (e: { id: string }) => e.id === epicId,
    ) as { modifiedAt: string };

    const res = await request(app.getHttpServer())
      .patch(`/api/epics/${epicId}`)
      .set('Cookie', cookie)
      .send({ title: 'Checkout flow' }) // same value → no change
      .expect(200);

    expect(res.body.modifiedAt).toBe(original.modifiedAt);
  });

  it('renames an epic and clears its description (200)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/epics/${epicId}`)
      .set('Cookie', cookie)
      .send({ title: 'Checkout v2', description: '   ' })
      .expect(200);

    expect(res.body.title).toBe('Checkout v2');
    expect(res.body.description).toBeNull();
  });

  it('blocks deleting an epic referenced by a ticket (409)', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        teamId,
        epicId,
        type: 'feature',
        title: 'Refer epic',
        body: 'body',
        createdById: userId,
      },
    });

    await request(app.getHttpServer())
      .delete(`/api/epics/${epicId}`)
      .set('Cookie', cookie)
      .expect(409);

    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  it('deletes an unreferenced epic (204) then 404 on re-delete', async () => {
    await request(app.getHttpServer())
      .delete(`/api/epics/${epicId}`)
      .set('Cookie', cookie)
      .expect(204);

    await request(app.getHttpServer())
      .delete(`/api/epics/${epicId}`)
      .set('Cookie', cookie)
      .expect(404);
  });
});
