import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { User } from './auth.service';
import { roleGuard } from './role.guard';
import { createFakeAuth, provideFakeAuth } from './testing';

describe('roleGuard', () => {
  function run(user: User | null, ...roles: string[]) {
    const auth = createFakeAuth(user);
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideFakeAuth(auth)] });
    const result = TestBed.runInInjectionContext(() =>
      roleGuard(...roles)({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as Promise<boolean | UrlTree>;
    return { auth, result };
  }

  it('lets in a user who has one of the roles', async () => {
    const { result } = run({ username: 'admin1', roles: ['admin'] }, 'warehouse', 'admin');

    await expect(result).resolves.toBe(true);
  });

  it('sends a user without the role to the catalogue', async () => {
    const { result } = run({ username: 'customer1', roles: ['customer'] }, 'warehouse', 'admin');

    const destination = (await result) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(destination)).toBe('/products');
  });

  it('sends a visitor who is not logged in to the catalogue', async () => {
    const { result } = run(null, 'customer');

    const destination = (await result) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(destination)).toBe('/products');
  });

  it('waits until the login check has finished before deciding', async () => {
    const { auth, result } = run({ username: 'customer1', roles: ['customer'] }, 'customer');

    await result;
    expect(auth.whenReady).toHaveBeenCalled();
  });
});
