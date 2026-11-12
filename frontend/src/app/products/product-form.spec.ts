import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductForm } from './product-form';
import { Product } from './product.service';

describe('ProductForm', () => {
  let fixture: ComponentFixture<ProductForm>;
  let http: HttpTestingController;
  let element: HTMLElement;
  let created: Product[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductForm],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductForm);
    http = TestBed.inject(HttpTestingController);
    element = fixture.nativeElement as HTMLElement;
    created = [];
    fixture.componentInstance.created.subscribe((product) => created.push(product));
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function fill(values: Record<string, string>): void {
    for (const [name, value] of Object.entries(values)) {
      const input = element.querySelector<HTMLInputElement>(`input[formControlName="${name}"]`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
  }

  function submit(): void {
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  const button = () => element.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const valid = { sku: 'HD-001', name: 'Headset', price: '59', stockQuantity: '25' };

  it('cannot be submitted until the required fields are filled', () => {
    expect(button().disabled).toBe(true);

    submit();
    http.expectNone('/api/products');

    fill(valid);
    expect(button().disabled).toBe(false);
  });

  it('saves the product, announces it and clears the form', async () => {
    fill(valid);
    submit();

    const request = http.expectOne('/api/products');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      sku: 'HD-001',
      name: 'Headset',
      price: 59,
      stockQuantity: 25,
    });
    expect(button().textContent).toContain('Saving');

    request.flush({ id: 7, sku: 'HD-001', name: 'Headset', price: 59, stockQuantity: 25 });
    await fixture.whenStable();

    expect(created.map((product) => product.id)).toEqual([7]);
    expect(element.querySelector<HTMLInputElement>('input[formControlName="sku"]')!.value).toBe('');
    expect(element.querySelector('.error')).toBeNull();
  });

  it('explains a duplicate SKU and keeps what was typed', async () => {
    fill(valid);
    submit();
    http
      .expectOne('/api/products')
      .flush('conflict', { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();

    expect(element.querySelector('.error')?.textContent).toContain('already exists');
    expect(element.querySelector<HTMLInputElement>('input[formControlName="sku"]')!.value).toBe(
      'HD-001',
    );
    expect(created).toEqual([]);
  });

  it('explains that an admin login is needed when the backend refuses', async () => {
    fill(valid);
    submit();
    http
      .expectOne('/api/products')
      .flush('forbidden', { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    expect(element.querySelector('.error')?.textContent).toContain('Only an admin');
  });

  it('shows a general message for any other failure', async () => {
    fill(valid);
    submit();
    http.expectOne('/api/products').flush('boom', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(element.querySelector('.error')?.textContent).toContain('Could not save');
  });
});
