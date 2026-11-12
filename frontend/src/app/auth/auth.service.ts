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
  readonly isAdmin = computed(() => this.user()?.roles.includes('admin') ?? false);

  /** Finds out, without leaving the page, whether the visitor already has a Keycloak session. */
  async init(): Promise<void> {
    try {
      const loggedIn = await this.keycloak.init({
        onLoad: 'check-sso',
        pkceMethod: 'S256',
        silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
        checkLoginIframe: false,
      });
      this.user.set(loggedIn ? this.readUser() : null);
    } catch {
      // Keycloak is unreachable: the public pages still work, just without a login.
      this.user.set(null);
    }
    this.status.set('ready');
  }

  /** Sends the browser to Keycloak's login page; it returns here afterwards. */
  login(): Promise<void> {
    return this.keycloak.login();
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
