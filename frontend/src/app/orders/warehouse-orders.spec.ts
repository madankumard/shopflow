import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { User } from '../auth/auth.service';
import { createFakeAuth, provideFakeAuth } from '../auth/testing';
import { Order, OrderStatus } from './order.service';
import { WarehouseOrders } from './warehouse-orders';

describe('WarehouseOrders', () => {
  const warehouse: User = { username: 'warehouse1', roles: ['warehouse'] };
  const admin: User = { username: 'admin1', roles: ['admin'] };

  let fixture: ComponentFixture<WarehouseOrders>;
  let http: HttpTestingController;
  let element: HTMLElement;

  function order(id: number, status: OrderStatus): Order {
    return {
      id,
      customer: 'customer1',
      status,
      total: 49,
      createdAt: '2026-11-13T10:00:00Z',
      updatedAt: '2026-11-13T10:00:00Z',
      lines: [{ productId: 2, productName: 'Mouse', unitPrice: 24.5, quantity: 2, lineTotal: 49 }],
    };
  }

  async function setup(user: User, orders?: Order[]): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [WarehouseOrders],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideFakeAuth(createFakeAuth(user)),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WarehouseOrders);
    http = TestBed.inject(HttpTestingController);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    if (orders) {
      http.expectOne('/api/orders').flush(orders);
      await fixture.whenStable();
    }
  }

  afterEach(() => http.verify());

  const rows = () => Array.from(element.querySelectorAll('tbody tr'));
  const button = (row: Element, kind: 'advance' | 'cancel') =>
    row.querySelector<HTMLButtonElement>(`button.${kind}`);

  it('says it is loading until the orders arrive', async () => {
    await setup(warehouse);

    expect(element.textContent).toContain('Loading orders');
    http.expectOne('/api/orders').flush([]);
  });

  it('says so when there are no orders', async () => {
    await setup(warehouse, []);

    expect(element.textContent).toContain('No orders yet.');
  });

  it('shows an error message when the orders cannot be loaded', async () => {
    await setup(warehouse);
    http.expectOne('/api/orders').flush('boom', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(element.querySelector('.error')?.textContent).toContain('Could not load the orders');
  });

  it('offers the next step for each open order and nothing for finished ones', async () => {
    await setup(warehouse, [
      order(1, 'PLACED'),
      order(2, 'PACKED'),
      order(3, 'SHIPPED'),
      order(4, 'DELIVERED'),
      order(5, 'CANCELLED'),
    ]);

    expect(rows().map((row) => button(row, 'advance')?.textContent?.trim() ?? null)).toEqual([
      'Mark packed',
      'Mark shipped',
      'Mark delivered',
      null,
      null,
    ]);
    expect(rows()[0].textContent).toContain('customer1');
    expect(rows()[0].textContent).toContain('2 × Mouse');
  });

  it('does not offer Cancel to warehouse staff', async () => {
    await setup(warehouse, [order(1, 'PLACED')]);

    expect(button(rows()[0], 'cancel')).toBeNull();
  });

  it('offers Cancel to an admin only while the order has not shipped', async () => {
    await setup(admin, [order(1, 'PLACED'), order(2, 'PACKED'), order(3, 'SHIPPED')]);

    expect(rows().map((row) => button(row, 'cancel') !== null)).toEqual([true, true, false]);
  });

  it('moves an order on and shows its new status and next step', async () => {
    await setup(warehouse, [order(1, 'PLACED'), order(2, 'PLACED')]);

    button(rows()[0], 'advance')!.click();
    fixture.detectChanges();
    // While one change is in flight, every button waits.
    expect(button(rows()[1], 'advance')!.disabled).toBe(true);

    const request = http.expectOne('/api/orders/1/advance');
    expect(request.request.method).toBe('POST');
    request.flush(order(1, 'PACKED'));
    await fixture.whenStable();

    expect(rows()[0].querySelector('.status')?.textContent).toContain('packed');
    expect(button(rows()[0], 'advance')?.textContent).toContain('Mark shipped');
    expect(button(rows()[1], 'advance')!.disabled).toBe(false);
  });

  it('lets an admin cancel an order', async () => {
    await setup(admin, [order(1, 'PLACED')]);

    button(rows()[0], 'cancel')!.click();
    http.expectOne('/api/orders/1/cancel').flush(order(1, 'CANCELLED'));
    await fixture.whenStable();

    expect(rows()[0].querySelector('.status')?.textContent).toContain('cancelled');
    expect(button(rows()[0], 'advance')).toBeNull();
    expect(button(rows()[0], 'cancel')).toBeNull();
  });

  it('refreshes the list when someone else changed the order first', async () => {
    await setup(warehouse, [order(1, 'PLACED')]);

    button(rows()[0], 'advance')!.click();
    http.expectOne('/api/orders/1/advance').flush('conflict', { status: 409, statusText: 'Conflict' });
    http.expectOne('/api/orders').flush([order(1, 'DELIVERED')]);
    await fixture.whenStable();

    expect(element.querySelector('.error')?.textContent).toContain('had already changed');
    expect(rows()[0].querySelector('.status')?.textContent).toContain('delivered');
  });

  it('reports any other failure and leaves the order as it was', async () => {
    await setup(warehouse, [order(1, 'PLACED')]);

    button(rows()[0], 'advance')!.click();
    http.expectOne('/api/orders/1/advance').flush('boom', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(element.querySelector('.error')?.textContent).toContain('Could not update order #1');
    expect(rows()[0].querySelector('.status')?.textContent).toContain('placed');
    expect(button(rows()[0], 'advance')!.disabled).toBe(false);
  });
});
