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
 * How long page guards and an early click on Log in wait for the start-up login check.
 * The check can go unanswered (Keycloak refuses an address it does not know, or is slow to
 * start), and those waits must end. The check itself is never abandoned: if it answers
 * later, its result is still used.
 */
export const LOGIN_CHECK_TIMEOUT_MS = 8000;

export interface User {
  username: string;
  roles: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly keycloak = inject(KEYCLOAK);

  /**
   * 'loading' until the start-up check has answered or the time limit has passed. Nothing on
   * screen waits for this: Log in is shown throughout, until a session is confirmed.
   */
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

  /**
   * Resolves once the start-up check has answered, or after LOGIN_CHECK_TIMEOUT_MS if it has
   * not. Route guards wait for this.
   */
  whenReady(): Promise<void> {
    return this.ready;
  }

  /**
   * Finds out, without leaving the page, whether the visitor already has a Keycloak session.
   * When returning from Keycloak's login page, this is also where the login is completed.
   */
  async init(): Promise<void> {
    const timer = setTimeout(() => {
      console.warn(
        `ShopFlow: the login server has not answered after ${LOGIN_CHECK_TIMEOUT_MS / 1000} s. ` +
          'Carrying on as logged out; the answer is still used if it arrives.',
      );
      this.markReady();
    }, LOGIN_CHECK_TIMEOUT_MS);

    try {
      const loggedIn = await this.keycloak.init({
        onLoad: 'check-sso',
        pkceMethod: 'S256',
        silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
        checkLoginIframe: false,
      });
      // Applied even when it arrives after the time limit, so a slow login still counts.
      this.user.set(loggedIn ? this.readUser() : null);
    } catch (error) {
      console.warn('ShopFlow: the login check failed. Carrying on as logged out.', error);
      this.user.set(null);
    } finally {
      clearTimeout(timer);
      this.markReady();
    }
  }

  /**
   * Sends the browser to Keycloak's login page; it returns here afterwards.
   *
   * Log in is on screen while the start-up check is still running. A click in that moment
   * waits for the check first: the visitor may turn out to be logged in already, or be on
   * their way back from Keycloak, and starting a new login would throw that away.
   */
  async login(): Promise<void> {
    await this.whenReady();
    if (this.user()) {
      return;
    }
    try {
      await this.keycloak.login();
    } catch (error) {
      console.error('ShopFlow: could not open the login page.', error);
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

  private markReady(): void {
    if (this.status() === 'ready') {
      return;
    }
    this.status.set('ready');
    this.resolveReady();
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
