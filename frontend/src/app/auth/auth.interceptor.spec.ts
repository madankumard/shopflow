import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authInterceptor } from './auth.interceptor';
import { User } from './auth.service';
import { createFakeAuth, provideFakeAuth } from './testing';

describe('authInterceptor', () => {
  function setup(user: User | null) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideFakeAuth(createFakeAuth(user)),
      ],
    });
    return {
      http: TestBed.inject(HttpClient),
      backend: TestBed.inject(HttpTestingController),
    };
  }

  /** Lets the interceptor's token lookup, which is asynchronous, complete. */
  const settle = () => new Promise((resolve) => setTimeout(resolve));

  it('adds the token to API calls when logged in', async () => {
    const { http, backend } = setup({ username: 'admin1', roles: ['admin'] });

    http.post('/api/products', {}).subscribe();
    await settle();

    const request = backend.expectOne('/api/products');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush({});
  });

  it('sends API calls without a token when logged out', () => {
    const { http, backend } = setup(null);

    http.get('/api/products').subscribe();

    const request = backend.expectOne('/api/products');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush([]);
  });

  it('never sends the token to other addresses', () => {
    const { http, backend } = setup({ username: 'admin1', roles: ['admin'] });

    http.get('https://example.com/data').subscribe();

    const request = backend.expectOne('https://example.com/data');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });
});
