import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { TeamsModule } from './teams/teams.module';
import { EpicsModule } from './epics/epics.module';
import { TicketsModule } from './tickets/tickets.module';
import { CommentsModule } from './comments/comments.module';

@Module({
  imports: [
    // Single source of truth for env: the repo-root .env (native dev) with a
    // local backend/.env fallback. Loaded globally and before other providers
    // so PrismaClient sees DATABASE_URL. Feature modules (Teams, Epics,
    // Tickets, Comments) will be added here as they are built.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../.env', '.env'] }),
    PrismaModule,
    AuthModule,
    TeamsModule,
    EpicsModule,
    TicketsModule,
    CommentsModule,
    HealthModule,
  ],
})
export class AppModule {}
