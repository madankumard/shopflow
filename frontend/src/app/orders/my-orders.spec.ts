import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MyOrders } from './my-orders';

describe('MyOrders', () => {
  let fixture: ComponentFixture<MyOrders>;
  let http: HttpTestingController;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyOrders],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MyOrders);
    http = TestBed.inject(HttpTestingController);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('says it is loading until the orders arrive', () => {
    expect(element.textContent).toContain('Loading your orders');

    http.expectOne('/api/orders/mine').flush([]);
  });

  it('shows each order with its status, lines and total', async () => {
    http.expectOne('/api/orders/mine').flush([
      {
        id: 12,
        customer: 'customer1',
        status: 'SHIPPED',
        total: 184.48,
        createdAt: '2026-11-13T10:00:00Z',
        updatedAt: '2026-11-13T12:00:00Z',
        lines: [
          { productId: 1, productName: 'Keyboard', unitPrice: 79.99, quantity: 2, lineTotal: 159.98 },
          { productId: 2, productName: 'Mouse', unitPrice: 24.5, quantity: 1, lineTotal: 24.5 },
        ],
      },
      {
        id: 11,
        customer: 'customer1',
        status: 'CANCELLED',
        total: 24.5,
        createdAt: '2026-11-12T10:00:00Z',
        updatedAt: '2026-11-12T11:00:00Z',
        lines: [{ productId: 2, productName: 'Mouse', unitPrice: 24.5, quantity: 1, lineTotal: 24.5 }],
      },
    ]);
    await fixture.whenStable();

    const orders = element.querySelectorAll('.order');
    expect(orders.length).toBe(2);
    expect(orders[0].querySelector('header')?.textContent).toContain('Order #12');
    expect(orders[0].querySelector('.status')?.textContent).toContain('shipped');
    expect(orders[0].querySelector('.status')?.getAttribute('data-status')).toBe('SHIPPED');
    expect(orders[0].querySelectorAll('li').length).toBe(2);
    expect(orders[0].querySelector('li')?.textContent).toContain('2 × Keyboard');
    expect(orders[0].querySelector('footer')?.textContent).toContain('$184.48');
    expect(orders[1].querySelector('.status')?.textContent).toContain('cancelled');
  });

  it('points to the catalogue when there are no orders yet', async () => {
    http.expectOne('/api/orders/mine').flush([]);
    await fixture.whenStable();

    expect(element.textContent).toContain('You have not placed any orders yet');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/products');
  });

  it('shows an error message when the orders cannot be loaded', async () => {
    http.expectOne('/api/orders/mine').flush('boom', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(element.querySelector('.error')?.textContent).toContain('Could not load your orders');
  });
});
