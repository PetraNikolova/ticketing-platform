import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { EmailService } from './../src/email/email.service';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * Tickets CRUD + state business flow (backend integration test):
 * auth guard → create (server-set createdBy/createdAt, default state) →
 * cross-team epic rejection → validation → list filters + title search →
 * detail with author → modifiedAt semantics (no-op, comment, state) →
 * team-change epic rules → delete cascades comments.
 *
 * EmailService is stubbed; a verified session is established via the real
 * signup → verify → login flow.
 */
describe('Tickets flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cookie: string;
  let userId: string;
  let teamA: string;
  let teamB: string;
  let epicA: string;
  let epicB: string;

  const email = `tickets.e2e.${Date.now()}@example.com`;
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

    userId = (await prisma.user.findUnique({ where: { email } }))!.id;

    const stamp = Date.now();
    const a = await prisma.team.create({ data: { name: `Tk A ${stamp}` } });
    const b = await prisma.team.create({ data: { name: `Tk B ${stamp}` } });
    teamA = a.id;
    teamB = b.id;
    epicA = (
      await prisma.epic.create({ data: { teamId: teamA, title: 'Epic A' } })
    ).id;
    epicB = (
      await prisma.epic.create({ data: { teamId: teamB, title: 'Epic B' } })
    ).id;
  });

  afterAll(async () => {
    // Leave the database clean (DoD). Comments cascade with their ticket.
    await prisma.ticket.deleteMany({
      where: { teamId: { in: [teamA, teamB] } },
    });
    await prisma.epic.deleteMany({ where: { teamId: { in: [teamA, teamB] } } });
    await prisma.team.deleteMany({ where: { id: { in: [teamA, teamB] } } });
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  const create = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/api/tickets')
      .set('Cookie', cookie)
      .send(body);

  it('rejects unauthenticated access (401)', async () => {
    await request(app.getHttpServer()).get('/api/tickets').expect(401);
  });

  it('creates a ticket (201): server sets createdBy/createdAt, defaults state', async () => {
    const res = await create({
      teamId: teamA,
      type: 'feature',
      title: '  Login page  ',
      body: '  As a user...  ',
    }).expect(201);

    expect(res.body.title).toBe('Login page'); // trimmed
    expect(res.body.state).toBe('new'); // default
    expect(res.body.createdById).toBe(userId); // from session, not the body
    expect(res.body.createdAt).toBeTruthy();
    expect(res.body.epicId).toBeNull();
  });

  it('creates a ticket referencing a same-team epic (201)', async () => {
    const res = await create({
      teamId: teamA,
      type: 'bug',
      epicId: epicA,
      title: 'Has epic',
      body: 'body',
    }).expect(201);
    expect(res.body.epicId).toBe(epicA);
  });

  it('rejects a ticket whose epic belongs to a different team (400)', async () => {
    await create({
      teamId: teamA,
      type: 'bug',
      epicId: epicB,
      title: 'Cross team',
      body: 'body',
    }).expect(400);
  });

  it('rejects invalid enum / blank fields (400)', async () => {
    await create({
      teamId: teamA,
      type: 'task',
      title: 'Bad type',
      body: 'body',
    }).expect(400);
    await create({
      teamId: teamA,
      type: 'fix',
      title: '   ',
      body: 'b',
    }).expect(400);
    await create({
      teamId: teamA,
      type: 'fix',
      title: 'x',
      body: '   ',
    }).expect(400);
  });

  it('lists tickets for a team with type filter and title search (200)', async () => {
    const all = await request(app.getHttpServer())
      .get('/api/tickets')
      .query({ teamId: teamA })
      .set('Cookie', cookie)
      .expect(200);
    expect(all.body.length).toBeGreaterThanOrEqual(2);

    const bugs = await request(app.getHttpServer())
      .get('/api/tickets')
      .query({ teamId: teamA, type: 'bug' })
      .set('Cookie', cookie)
      .expect(200);
    expect(bugs.body.every((t: { type: string }) => t.type === 'bug')).toBe(
      true,
    );

    // Case-insensitive substring search over title.
    const search = await request(app.getHttpServer())
      .get('/api/tickets')
      .query({ teamId: teamA, q: 'LOGIN' })
      .set('Cookie', cookie)
      .expect(200);
    expect(
      search.body.some((t: { title: string }) => t.title === 'Login page'),
    ).toBe(true);
  });

  it('returns full ticket detail including author (200)', async () => {
    const created = await create({
      teamId: teamA,
      type: 'fix',
      title: 'Detail me',
      body: 'body',
    }).expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/tickets/${created.body.id}`)
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.id).toBe(created.body.id);
    expect(res.body.createdBy.email).toBe(email);
  });

  it('does not advance modifiedAt on a no-op edit or on a new comment', async () => {
    const created = await create({
      teamId: teamA,
      type: 'feature',
      title: 'Stable mod',
      body: 'body',
    }).expect(201);
    const id = created.body.id as string;
    const originalModifiedAt = created.body.modifiedAt as string;

    // No-op edit (same values).
    const noop = await request(app.getHttpServer())
      .patch(`/api/tickets/${id}`)
      .set('Cookie', cookie)
      .send({ title: 'Stable mod', body: 'body' })
      .expect(200);
    expect(noop.body.modifiedAt).toBe(originalModifiedAt);

    // Adding a comment must not touch the ticket row.
    await prisma.comment.create({
      data: { ticketId: id, authorId: userId, body: 'a comment' },
    });
    const afterComment = await request(app.getHttpServer())
      .get(`/api/tickets/${id}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(afterComment.body.modifiedAt).toBe(originalModifiedAt);
  });

  it('persists a drag-and-drop state change; no-op state stays put', async () => {
    const created = await create({
      teamId: teamA,
      type: 'feature',
      title: 'Move me',
      body: 'body',
    }).expect(201);
    const id = created.body.id as string;

    const moved = await request(app.getHttpServer())
      .patch(`/api/tickets/${id}/state`)
      .set('Cookie', cookie)
      .send({ state: 'in_progress' })
      .expect(200);
    expect(moved.body.state).toBe('in_progress');

    // Same-column drop is a no-op and keeps modifiedAt.
    const noop = await request(app.getHttpServer())
      .patch(`/api/tickets/${id}/state`)
      .set('Cookie', cookie)
      .send({ state: 'in_progress' })
      .expect(200);
    expect(noop.body.modifiedAt).toBe(moved.body.modifiedAt);

    await request(app.getHttpServer())
      .patch(`/api/tickets/${id}/state`)
      .set('Cookie', cookie)
      .send({ state: 'not_a_state' })
      .expect(400);
  });

  it('rejects a team change that leaves a cross-team epic, allows it when epic cleared', async () => {
    const created = await create({
      teamId: teamA,
      type: 'bug',
      epicId: epicA,
      title: 'Team move',
      body: 'body',
    }).expect(201);
    const id = created.body.id as string;

    // Move to team B while epic A (team A) is still attached → 400.
    await request(app.getHttpServer())
      .patch(`/api/tickets/${id}`)
      .set('Cookie', cookie)
      .send({ teamId: teamB })
      .expect(400);

    // Move to team B and clear the epic in the same request → 200.
    const ok = await request(app.getHttpServer())
      .patch(`/api/tickets/${id}`)
      .set('Cookie', cookie)
      .send({ teamId: teamB, epicId: null })
      .expect(200);
    expect(ok.body.teamId).toBe(teamB);
    expect(ok.body.epicId).toBeNull();
  });

  it('deletes a ticket (204), cascading its comments, then 404', async () => {
    const created = await create({
      teamId: teamA,
      type: 'fix',
      title: 'Delete me',
      body: 'body',
    }).expect(201);
    const id = created.body.id as string;
    await prisma.comment.create({
      data: { ticketId: id, authorId: userId, body: 'will cascade' },
    });

    await request(app.getHttpServer())
      .delete(`/api/tickets/${id}`)
      .set('Cookie', cookie)
      .expect(204);

    expect(await prisma.comment.count({ where: { ticketId: id } })).toBe(0);
    await request(app.getHttpServer())
      .get(`/api/tickets/${id}`)
      .set('Cookie', cookie)
      .expect(404);
  });
});
