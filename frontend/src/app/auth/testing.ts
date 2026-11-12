import { Provider, computed, signal } from '@angular/core';
import { vi } from 'vitest';
import { AuthService, User } from './auth.service';

/** A stand-in for AuthService in component tests: no Keycloak, just the given user. */
export function createFakeAuth(user: User | null = null, status: 'loading' | 'ready' = 'ready') {
  const current = signal<User | null>(user);
  return {
    status: signal(status),
    user: current,
    isAdmin: computed(() => current()?.roles.includes('admin') ?? false),
    init: vi.fn(async () => undefined),
    login: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
    token: vi.fn(async () => (current() ? 'test-token' : undefined)),
  };
}

export function provideFakeAuth(fake = createFakeAuth()): Provider {
  return { provide: AuthService, useValue: fake };
}
