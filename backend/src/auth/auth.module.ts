import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    EmailModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const ttl = config.get<string>('SESSION_TTL') ?? '7d';
        return {
          secret: config.getOrThrow<string>('JWT_SECRET'),
          // expiresIn as a number of seconds (avoids the StringValue type).
          signOptions: {
            expiresIn: Math.floor(AuthService.parseDurationMs(ttl) / 1000),
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // Registered globally: protects every route except those marked @Public.
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
