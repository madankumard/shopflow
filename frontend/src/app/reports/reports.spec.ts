import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Report } from './report.service';
import { Reports } from './reports';

describe('Reports', () => {
  let fixture: ComponentFixture<Reports>;
  let http: HttpTestingController;
  let element: HTMLElement;

  const report: Report = {
    orders: 12,
    revenue: 1840.5,
    cancelledOrders: 2,
    daily: [
      { date: '2026-11-11', orders: 0, revenue: 0 },
      { date: '2026-11-12', orders: 4, revenue: 400 },
      { date: '2026-11-13', orders: 8, revenue: 1600 },
    ],
    topProducts: [
      { productId: 1, productName: 'Keyboard', unitsSold: 15, revenue: 1199.85 },
      { productId: 2, productName: 'Mouse', unitsSold: 9, revenue: 220.5 },
    ],
    lowStockThreshold: 10,
    lowStock: [
      { id: 3, sku: 'MN-001', name: 'Monitor', stockQuantity: 0 },
      { id: 1, sku: 'KB-001', name: 'Keyboard', stockQuantity: 7 },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Reports],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Reports);
    http = TestBed.inject(HttpTestingController);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  async function load(data: Report): Promise<void> {
    http.expectOne('/api/reports').flush(data);
    await fixture.whenStable();
  }

  const tile = (label: string) =>
    Array.from(element.querySelectorAll('.tile'))
      .find((candidate) => candidate.querySelector('.label')?.textContent?.trim() === label)
      ?.querySelector('.value')
      ?.textContent?.trim();

  it('says it is loading until the figures arrive', async () => {
    expect(element.textContent).toContain('Loading the figures');

    await load(report);
  });

  it('shows the headline numbers', async () => {
    await load(report);

    expect(tile('Orders')).toBe('12');
    expect(tile('Revenue')).toBe('$1,840.50');
    expect(tile('Cancelled orders')).toBe('2');
  });

  it('lists each day with a bar sized against the busiest day', async () => {
    await load(report);

    const rows = element.querySelectorAll('.daily tbody tr');
    expect(element.querySelector('.daily h3')?.textContent).toContain('Last 3 days');
    expect(rows.length).toBe(3);
    expect(rows[1].textContent).toContain('Thu 12 Nov');
    expect(rows[1].textContent).toContain('$400.00');
    const widths = Array.from(rows).map(
      (row) => (row.querySelector('.bar') as HTMLElement).style.width,
    );
    expect(widths).toEqual(['0%', '25%', '100%']);
  });

  it('lists the best-selling products in the order given', async () => {
    await load(report);

    const rows = element.querySelectorAll('.top-products tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Keyboard');
    expect(rows[0].textContent).toContain('15');
    expect(rows[0].textContent).toContain('$1,199.85');
  });

  it('lists low stock with the threshold and marks products that have run out', async () => {
    await load(report);

    expect(element.querySelector('.low-stock .note')?.textContent).toContain('10 or fewer');
    const rows = element.querySelectorAll('.low-stock tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('MN-001');
    expect(rows[0].classList.contains('out')).toBe(true);
    expect(rows[1].classList.contains('out')).toBe(false);
  });

  it('says so in each section when there is nothing to show', async () => {
    await load({
      orders: 0,
      revenue: 0,
      cancelledOrders: 0,
      daily: [{ date: '2026-11-13', orders: 0, revenue: 0 }],
      topProducts: [],
      lowStockThreshold: 10,
      lowStock: [],
    });

    expect(tile('Orders')).toBe('0');
    expect(tile('Revenue')).toBe('$0.00');
    expect(element.querySelector('.daily')?.textContent).toContain('No sales in this period.');
    expect(element.querySelector('.top-products')?.textContent).toContain('Nothing has been sold yet.');
    expect(element.querySelector('.low-stock')?.textContent).toContain(
      'Every product is above that level.',
    );
    expect(element.querySelectorAll('table').length).toBe(0);
  });

  it('shows an error message when the figures cannot be loaded', async () => {
    http.expectOne('/api/reports').flush('boom', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(element.querySelector('.error')?.textContent).toContain('Could not load the reports');
    expect(element.querySelector('.tiles')).toBeNull();
  });
});
