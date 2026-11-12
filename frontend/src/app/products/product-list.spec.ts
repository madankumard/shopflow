import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { User } from '../auth/auth.service';
import { createFakeAuth, provideFakeAuth } from '../auth/testing';
import { ProductList } from './product-list';

describe('ProductList', () => {
  let fixture: ComponentFixture<ProductList>;
  let http: HttpTestingController;

  async function setup(user: User | null = null): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ProductList],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideFakeAuth(createFakeAuth(user)),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductList);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('shows a row for each product returned by the API', async () => {
    await setup();
    http.expectOne('/api/products').flush([
      { id: 1, sku: 'KB-001', name: 'Mechanical Keyboard', price: 79.99, stockQuantity: 40 },
      { id: 2, sku: 'MS-001', name: 'Wireless Mouse', price: 24.5, stockQuantity: 120 },
    ]);
    await fixture.whenStable();

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Mechanical Keyboard');
    expect(rows[0].textContent).toContain('$79.99');
  });

  it('shows an empty message when there are no products', async () => {
    await setup();
    http.expectOne('/api/products').flush([]);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No products yet.');
  });

  it('shows an error message when the API fails', async () => {
    await setup();
    http.expectOne('/api/products').flush('boom', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('.error')).not.toBeNull();
  });

  it('offers the add-product form to admins only', async () => {
    await setup({ username: 'customer1', roles: ['customer'] });
    http.expectOne('/api/products').flush([]);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('app-product-form')).toBeNull();
  });

  it('reloads the list after an admin adds a product', async () => {
    await setup({ username: 'admin1', roles: ['admin'] });
    http.expectOne('/api/products').flush([]);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('app-product-form')).not.toBeNull();

    for (const [name, value] of Object.entries({ sku: 'HD-001', name: 'Headset' })) {
      const input = element.querySelector<HTMLInputElement>(`input[formControlName="${name}"]`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    const saved = { id: 9, sku: 'HD-001', name: 'Headset', price: 0, stockQuantity: 0 };
    http.expectOne({ method: 'POST', url: '/api/products' }).flush(saved);

    http.expectOne({ method: 'GET', url: '/api/products' }).flush([saved]);
    await fixture.whenStable();

    expect(element.querySelectorAll('tbody tr').length).toBe(1);
    expect(element.querySelector('tbody')?.textContent).toContain('Headset');
  });
});
