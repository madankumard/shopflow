import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductList } from './product-list';

describe('ProductList', () => {
  let fixture: ComponentFixture<ProductList>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductList],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductList);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('shows a row for each product returned by the API', async () => {
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
    http.expectOne('/api/products').flush([]);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No products yet.');
  });

  it('shows an error message when the API fails', async () => {
    http.expectOne('/api/products').flush('boom', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('.error')).not.toBeNull();
  });
});
