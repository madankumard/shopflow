import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Product } from '../products/product.service';
import { Cart } from './cart';
import { CartService } from './cart.service';

describe('Cart', () => {
  const keyboard: Product = { id: 1, sku: 'KB-001', name: 'Keyboard', price: 80, stockQuantity: 5 };
  const mouse: Product = { id: 2, sku: 'MS-001', name: 'Mouse', price: 20, stockQuantity: 10 };

  let fixture: ComponentFixture<Cart>;
  let http: HttpTestingController;
  let element: HTMLElement;
  let cart: CartService;
  let stockChanges: number;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Cart],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Cart);
    http = TestBed.inject(HttpTestingController);
    cart = TestBed.inject(CartService);
    element = fixture.nativeElement as HTMLElement;
    stockChanges = 0;
    fixture.componentInstance.stockChanged.subscribe(() => stockChanges++);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const placeButton = () => element.querySelector<HTMLButtonElement>('button.place');

  async function pick(): Promise<void> {
    cart.add(keyboard);
    cart.add(keyboard);
    cart.add(mouse);
    await fixture.whenStable();
  }

  it('says nothing is picked and offers no button when empty', () => {
    expect(element.querySelector('.message')?.textContent).toContain('Nothing picked yet');
    expect(placeButton()).toBeNull();
  });

  it('lists what was picked with line totals and the order total', async () => {
    await pick();

    const rows = element.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Keyboard');
    expect(rows[0].textContent).toContain('$160.00');
    expect(element.querySelector('.total')?.textContent).toContain('$180.00');
  });

  it('changes a quantity and removes a line', async () => {
    await pick();

    const quantity = element.querySelector<HTMLInputElement>('tbody input')!;
    quantity.value = '4';
    quantity.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(element.querySelector('.total')?.textContent).toContain('$340.00');

    element.querySelector<HTMLButtonElement>('tbody button')!.click();
    await fixture.whenStable();
    expect(element.querySelectorAll('tbody tr').length).toBe(1);
    expect(element.querySelector('.total')?.textContent).toContain('$20.00');
  });

  it('places the order, confirms it, empties the cart and reports that stock changed', async () => {
    await pick();
    placeButton()!.click();
    fixture.detectChanges();

    const request = http.expectOne('/api/orders');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      lines: [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 1 },
      ],
    });
    expect(placeButton()!.disabled).toBe(true);

    request.flush({ id: 42, total: 180, status: 'PLACED', lines: [] });
    await fixture.whenStable();

    expect(element.querySelector('.success')?.textContent).toContain('Order #42 placed');
    expect(element.querySelector('.success a')?.getAttribute('href')).toBe('/orders');
    expect(cart.isEmpty()).toBe(true);
    expect(placeButton()).toBeNull();
    expect(stockChanges).toBe(1);
  });

  it('keeps the cart and asks for fresh stock numbers when an item has run short', async () => {
    await pick();
    placeButton()!.click();
    http.expectOne('/api/orders').flush('conflict', { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();

    expect(element.querySelector('.error')?.textContent).toContain('no longer in stock');
    expect(cart.items().length).toBe(2);
    expect(stockChanges).toBe(1);
    expect(placeButton()!.disabled).toBe(false);
  });

  it('explains that a customer login is needed when the backend refuses', async () => {
    await pick();
    placeButton()!.click();
    http.expectOne('/api/orders').flush('forbidden', { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    expect(element.querySelector('.error')?.textContent).toContain('Only a logged-in customer');
    expect(stockChanges).toBe(0);
  });

  it('shows a general message for any other failure and keeps the cart', async () => {
    await pick();
    placeButton()!.click();
    http.expectOne('/api/orders').flush('boom', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(element.querySelector('.error')?.textContent).toContain('Could not place the order');
    expect(cart.items().length).toBe(2);
  });
});
