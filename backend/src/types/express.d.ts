import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

// Augment Express's Request so `request.user` (set by AuthGuard) is typed.
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
