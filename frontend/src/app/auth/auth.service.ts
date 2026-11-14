import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import Keycloak from 'keycloak-js';

/** The roles ShopFlow defines in Keycloak; a token also carries Keycloak's own built-in ones. */
const APP_ROLES = ['customer', 'warehouse', 'admin'];

/**
 * The Keycloak client. Keycloak is served from the same address as the app, under /auth,
 * in every environment, so nothing here is environment-specific. Tests replace this token.
 */
export const KEYCLOAK = new InjectionToken<Keycloak>('keycloak', {
  providedIn: 'root',
  factory: () =>
    new Keycloak({
      url: `${window.location.origin}/auth`,
      realm: 'shopflow',
      clientId: 'shopflow-web',
    }),
});

/**
 * How long to wait for Keycloak to say whether the visitor is logged in. The check runs in a
 * hidden frame, and when Keycloak refuses it (for example an address it does not know) no
 * answer ever comes back. Nothing on screen waits for this, but page guards and a login
 * clicked very early do, so the wait has to end.
 */
export const LOGIN_CHECK_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out')), milliseconds);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export interface User {
  username: string;
  roles: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly keycloak = inject(KEYCLOAK);

  /** 'loading' until Keycloak has said whether the visitor is already logged in. */
  readonly status = signal<'loading' | 'ready'>('loading');
  readonly user = signal<User | null>(null);
  readonly isAdmin = computed(() => this.hasAnyRole('admin'));
  readonly isCustomer = computed(() => this.hasAnyRole('customer'));
  /** The people who work through orders: warehouse staff and admins. */
  readonly isStaff = computed(() => this.hasAnyRole('warehouse', 'admin'));

  private resolveReady!: () => void;
  private readonly ready = new Promise<void>((resolve) => (this.resolveReady = resolve));

  hasAnyRole(...roles: string[]): boolean {
    const mine = this.user()?.roles ?? [];
    return roles.some((role) => mine.includes(role));
  }

  /** Resolves once it is known whether the visitor is logged in; route guards wait for this. */
  whenReady(): Promise<void> {
    return this.ready;
  }

  /** Finds out, without leaving the page, whether the visitor already has a Keycloak session. */
  async init(): Promise<void> {
    try {
      const loggedIn = await withTimeout(
        this.keycloak.init({
          onLoad: 'check-sso',
          pkceMethod: 'S256',
          silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
          checkLoginIframe: false,
        }),
        LOGIN_CHECK_TIMEOUT_MS,
      );
      this.user.set(loggedIn ? this.readUser() : null);
    } catch {
      // Keycloak is unreachable, or refused the check and never answered: the public pages
      // still work, and the visitor stays logged out.
      this.user.set(null);
    }
    this.status.set('ready');
    this.resolveReady();
  }

  /**
   * Sends the browser to Keycloak's login page; it returns here afterwards. The button is
   * on the page before the start-up check has finished, so if Keycloak's client is not
   * ready for a login yet, this waits for the check and then goes.
   */
  async login(): Promise<void> {
    try {
      await this.keycloak.login();
    } catch {
      await this.whenReady();
      await this.keycloak.login();
    }
  }

  logout(): Promise<void> {
    return this.keycloak.logout({ redirectUri: window.location.origin });
  }

  /** A token that is valid for at least the next 30 seconds, or undefined when logged out. */
  async token(): Promise<string | undefined> {
    if (!this.user()) {
      return undefined;
    }
    try {
      await this.keycloak.updateToken(30);
      return this.keycloak.token;
    } catch {
      // The session has ended at Keycloak (expired or logged out elsewhere).
      this.user.set(null);
      return undefined;
    }
  }

  private readUser(): User {
    const token = this.keycloak.tokenParsed;
    const roles = token?.realm_access?.roles ?? [];
    return {
      username: (token?.['preferred_username'] as string | undefined) ?? 'user',
      roles: roles.filter((role) => APP_ROLES.includes(role)),
    };
  }
}
