import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as exempt from the global AuthGuard (signup, login, logout,
 * email verification, resend, health).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
