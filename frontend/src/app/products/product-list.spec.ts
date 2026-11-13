import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
        provideRouter([]),
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

  it('shows no ordering controls to a visitor or to staff', async () => {
    await setup({ username: 'warehouse1', roles: ['warehouse'] });
    http
      .expectOne('/api/products')
      .flush([{ id: 1, sku: 'KB-001', name: 'Keyboard', price: 79.99, stockQuantity: 40 }]);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('button.add')).toBeNull();
    expect(element.querySelector('app-cart')).toBeNull();
  });

  it('lets a customer add products that are in stock to their order', async () => {
    await setup({ username: 'customer1', roles: ['customer'] });
    http.expectOne('/api/products').flush([
      { id: 1, sku: 'KB-001', name: 'Keyboard', price: 80, stockQuantity: 40 },
      { id: 3, sku: 'MN-001', name: 'Monitor', price: 229, stockQuantity: 0 },
    ]);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const rows = element.querySelectorAll('table tbody tr');

    expect(rows[1].querySelector('button.add')).toBeNull();
    expect(rows[1].textContent).toContain('Out of stock');

    rows[0].querySelector<HTMLButtonElement>('button.add')!.click();
    rows[0].querySelector<HTMLButtonElement>('button.add')!.click();
    await fixture.whenStable();

    const cart = element.querySelector('app-cart')!;
    expect(cart.querySelector('tbody tr')?.textContent).toContain('Keyboard');
    expect(cart.querySelector('.total')?.textContent).toContain('$160.00');
  });

  it('refreshes the stock numbers after a customer places an order', async () => {
    await setup({ username: 'customer1', roles: ['customer'] });
    http
      .expectOne('/api/products')
      .flush([{ id: 1, sku: 'KB-001', name: 'Keyboard', price: 80, stockQuantity: 40 }]);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('button.add')!.click();
    await fixture.whenStable();
    element.querySelector<HTMLButtonElement>('app-cart button.place')!.click();
    http.expectOne('/api/orders').flush({ id: 5, total: 80, status: 'PLACED', lines: [] });
    http
      .expectOne('/api/products')
      .flush([{ id: 1, sku: 'KB-001', name: 'Keyboard', price: 80, stockQuantity: 39 }]);
    await fixture.whenStable();

    expect(element.querySelector('table tbody tr')?.textContent).toContain('39');
    expect(element.querySelector('app-cart .success')?.textContent).toContain('Order #5 placed');
  });
});
