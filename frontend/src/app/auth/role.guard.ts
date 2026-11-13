import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Keeps a page for users with one of the given roles; everyone else is sent to the catalogue.
 * This only tidies the screen: the backend refuses the data regardless.
 */
export function roleGuard(...roles: string[]): CanActivateFn {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    await auth.whenReady();
    return auth.hasAnyRole(...roles) ? true : router.parseUrl('/products');
  };
}
