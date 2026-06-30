import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService, PublicUser } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './decorators/current-user.decorator';
import { SESSION_COOKIE } from './guards/auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('signup')
  @HttpCode(201)
  signup(@Body() dto: SignupDto): Promise<{ id: string; email: string }> {
    return this.auth.signup(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: PublicUser }> {
    const { token, user } = await this.auth.login(dto);
    res.cookie(SESSION_COOKIE, token, this.auth.cookieOptions());
    return { user };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response): { ok: true } {
    res.clearCookie(SESSION_COOKIE, this.auth.cookieClearOptions());
    return { ok: true };
  }

  @Public()
  @Get('verify')
  verify(@Query('token') token?: string): Promise<{ verified: true }> {
    return this.auth.verify(token);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(200)
  resend(@Body() dto: ResendVerificationDto): Promise<{ ok: true }> {
    return this.auth.resendVerification(dto.email);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): Promise<PublicUser> {
    return this.auth.me(user.userId);
  }
}
