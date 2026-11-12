import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  let fixture: ComponentFixture<App>;
  let http: HttpTestingController;
  let compiled: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
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

    request.flush({ environment: 'local', version: 'dev' });
  });

  it('shows the environment and version returned by the API', async () => {
    http.expectOne('/api/info').flush({ environment: 'qa', version: 'abc1234' });
    await fixture.whenStable();

    const badge = compiled.querySelector('.env-badge');
    expect(badge?.textContent).toContain('qa');
    expect(badge?.textContent).toContain('abc1234');
    expect(badge?.getAttribute('data-env')).toBe('qa');
  });

  it('shows no badge when the info API fails', async () => {
    http.expectOne('/api/info').flush('boom', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(compiled.querySelector('.env-badge')).toBeNull();
    expect(compiled.querySelector('h1')?.textContent).toContain('ShopFlow');
  });
});
