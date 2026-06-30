import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/** Shape attached to the request by AuthGuard after a valid session. */
export interface AuthenticatedUser {
  userId: string;
}

/**
 * Injects the authenticated user (resolved from the session cookie) into a
 * controller handler.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user as AuthenticatedUser;
  },
);
