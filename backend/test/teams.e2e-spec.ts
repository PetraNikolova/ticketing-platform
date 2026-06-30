import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { EmailService } from './../src/email/email.service';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * Teams CRUD business flow (backend integration test):
 * unauthenticated guard → create → list → case-insensitive duplicate (409) →
 * rename → delete-while-non-empty (409) → delete (204).
 *
 * EmailService is stubbed so signup is self-contained (no SMTP server). A
 * verified session is established via the real signup → verify → login flow.
 */
describe('Teams flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cookie: string;

  const email = `teams.e2e.${Date.now()}@example.com`;
  const password = 'sup3rsecret!';
  const teamName = `Team ${Date.now()}`;
  let capturedVerifyUrl = '';
  const createdTeamIds: string[] = [];

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

    // Establish a verified session through the public auth flow.
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
  });

  afterAll(async () => {
    // Leave the database clean (DoD: a fresh DB holds no application rows).
    await prisma.epic.deleteMany({ where: { teamId: { in: createdTeamIds } } });
    await prisma.team.deleteMany({ where: { id: { in: createdTeamIds } } });
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('rejects unauthenticated access to teams (401)', async () => {
    await request(app.getHttpServer()).get('/api/teams').expect(401);
  });

  it('rejects a blank team name (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/teams')
      .set('Cookie', cookie)
      .send({ name: '   ' })
      .expect(400);
  });

  it('creates a team (201), trimming the name', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/teams')
      .set('Cookie', cookie)
      .send({ name: `  ${teamName}  ` })
      .expect(201);

    expect(res.body.name).toBe(teamName);
    expect(res.body.id).toBeTruthy();
    createdTeamIds.push(res.body.id as string);
  });

  it('lists the created team (200)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/teams')
      .set('Cookie', cookie)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((t: { name: string }) => t.name === teamName)).toBe(
      true,
    );
  });

  it('rejects a case-insensitive duplicate name (409)', async () => {
    await request(app.getHttpServer())
      .post('/api/teams')
      .set('Cookie', cookie)
      .send({ name: teamName.toUpperCase() })
      .expect(409);
  });

  it('renames the team (200)', async () => {
    const renamed = `${teamName} renamed`;
    const res = await request(app.getHttpServer())
      .patch(`/api/teams/${createdTeamIds[0]}`)
      .set('Cookie', cookie)
      .send({ name: renamed })
      .expect(200);

    expect(res.body.name).toBe(renamed);
  });

  it('blocks deleting a team that contains an epic (409)', async () => {
    const epic = await prisma.epic.create({
      data: { teamId: createdTeamIds[0], title: 'Guard epic' },
    });

    await request(app.getHttpServer())
      .delete(`/api/teams/${createdTeamIds[0]}`)
      .set('Cookie', cookie)
      .expect(409);

    await prisma.epic.delete({ where: { id: epic.id } });
  });

  it('deletes an empty team (204)', async () => {
    await request(app.getHttpServer())
      .delete(`/api/teams/${createdTeamIds[0]}`)
      .set('Cookie', cookie)
      .expect(204);

    // It is gone; a second delete is a 404.
    await request(app.getHttpServer())
      .delete(`/api/teams/${createdTeamIds[0]}`)
      .set('Cookie', cookie)
      .expect(404);
    createdTeamIds.pop();
  });
});
