import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { createFakeAuth, provideFakeAuth } from './auth/testing';

describe('App', () => {
  let fixture: ComponentFixture<App>;
  let http: HttpTestingController;
  let compiled: HTMLElement;
  let auth: ReturnType<typeof createFakeAuth>;

  beforeEach(async () => {
    auth = createFakeAuth(null, 'loading');
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideFakeAuth(auth),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    http = TestBed.inject(HttpTestingController);
    compiled = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('renders the app name and navigation, with no badge while the info is loading', async () => {
    const request = http.expectOne('/api/info');

    expect(compiled.querySelector('h1')?.textContent).toContain('ShopFlow');
    expect(compiled.querySelector('nav a')?.textContent).toContain('Products');
    expect(compiled.querySelector('.env-badge')).toBeNull();

    request.flush({ environment: 'local', version: 'dev', banner: '' });
  });

  it('shows the environment and version returned by the API', async () => {
    http.expectOne('/api/info').flush({ environment: 'qa', version: 'abc1234', banner: '' });
    await fixture.whenStable();

    const badge = compiled.querySelector('.env-badge');
    expect(badge?.textContent).toContain('qa');
    expect(badge?.textContent).toContain('abc1234');
    expect(badge?.getAttribute('data-env')).toBe('qa');
    expect(compiled.querySelector('.env-banner')).toBeNull();
  });

  it('shows the banner when the environment has one', async () => {
    http
      .expectOne('/api/info')
      .flush({ environment: 'qa', version: 'abc1234', banner: 'Test data only.' });
    await fixture.whenStable();

    expect(compiled.querySelector('.env-banner')?.textContent).toContain('Test data only.');
  });

  it('shows no badge when the info API fails', async () => {
    http.expectOne('/api/info').flush('boom', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(compiled.querySelector('.env-badge')).toBeNull();
    expect(compiled.querySelector('.env-banner')).toBeNull();
    expect(compiled.querySelector('h1')?.textContent).toContain('ShopFlow');
  });

  describe('login', () => {
    const info = { environment: 'local', version: 'dev', banner: '' };

    it('offers Log in straight away, while the login check is still running', async () => {
      http.expectOne('/api/info').flush(info);
      await fixture.whenStable();

      expect(auth.status()).toBe('loading');
      const button = compiled.querySelector<HTMLButtonElement>('.auth .login');
      expect(button?.textContent).toContain('Log in');
      expect(compiled.querySelector('.auth .logout')).toBeNull();

      button!.click();
      expect(auth.login).toHaveBeenCalled();
    });

    it('swaps Log in for the user as soon as the check finds them logged in', async () => {
      http.expectOne('/api/info').flush(info);
      await fixture.whenStable();
      expect(compiled.querySelector('.auth .login')).not.toBeNull();

      auth.user.set({ username: 'customer1', roles: ['customer'] });
      auth.status.set('ready');
      await fixture.whenStable();

      expect(compiled.querySelector('.auth .login')).toBeNull();
      expect(compiled.querySelector('.auth .user')?.textContent).toContain('customer1');
    });

    it('offers Log in to a visitor and starts the login when clicked', async () => {
      http.expectOne('/api/info').flush(info);
      auth.status.set('ready');
      await fixture.whenStable();

      const button = compiled.querySelector<HTMLButtonElement>('.auth .login');
      expect(button?.textContent).toContain('Log in');
      expect(compiled.querySelector('.auth .logout')).toBeNull();

      button!.click();
      expect(auth.login).toHaveBeenCalled();
    });

    it('shows the user, their roles and Log out once logged in', async () => {
      http.expectOne('/api/info').flush(info);
      auth.user.set({ username: 'admin1', roles: ['admin'] });
      auth.status.set('ready');
      await fixture.whenStable();

      expect(compiled.querySelector('.auth .user')?.textContent).toContain('admin1');
      expect(compiled.querySelector('.auth .roles')?.textContent).toContain('admin');
      expect(compiled.querySelector('.auth .login')).toBeNull();

      compiled.querySelector<HTMLButtonElement>('.auth .logout')!.click();
      expect(auth.logout).toHaveBeenCalled();
    });
  });

  describe('navigation', () => {
    const info = { environment: 'local', version: 'dev', banner: '' };
    const links = () =>
      Array.from(compiled.querySelectorAll('nav a')).map((link) => link.textContent?.trim());

    it('shows only Products to a visitor', async () => {
      http.expectOne('/api/info').flush(info);
      auth.status.set('ready');
      await fixture.whenStable();

      expect(links()).toEqual(['Products']);
    });

    it('adds My orders for a customer', async () => {
      http.expectOne('/api/info').flush(info);
      auth.user.set({ username: 'customer1', roles: ['customer'] });
      auth.status.set('ready');
      await fixture.whenStable();

      expect(links()).toEqual(['Products', 'My orders']);
    });

    it('adds Orders for warehouse staff, and Reports as well for admins', async () => {
      http.expectOne('/api/info').flush(info);
      auth.user.set({ username: 'warehouse1', roles: ['warehouse'] });
      auth.status.set('ready');
      await fixture.whenStable();
      expect(links()).toEqual(['Products', 'Orders']);

      auth.user.set({ username: 'admin1', roles: ['admin'] });
      await fixture.whenStable();
      expect(links()).toEqual(['Products', 'Orders', 'Reports']);
    });
  });
});
