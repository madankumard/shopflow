import { expect, test } from '@playwright/test';
import { E2E_PRODUCT, logIn, openApp, orderCard, orderRow, placeOrder, productRow } from './support';

/**
 * The main journeys through ShopFlow, in a real browser, against a deployed environment.
 * They run in order and build on each other: the order a customer places is the one the
 * warehouse then ships. Every test starts in a fresh browser with nobody logged in.
 */
test.describe.configure({ mode: 'serial' });

/** The order the warehouse will deliver, and the one the admin will cancel. */
let orderToDeliver: number;
let orderToCancel: number;

test('a visitor can browse the catalogue but not order', async ({ page }) => {
  await openApp(page);

  await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
  await expect(page.locator('app-product-list > table tbody tr').first()).toBeVisible();
  await expect(page.locator('.env-badge')).toBeVisible();

  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to order' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'My orders', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Orders', exact: true })).toHaveCount(0);
  await expect(page.locator('app-product-form')).toHaveCount(0);
});

test('an admin logs in and makes sure the test product is in the catalogue', async ({ page }) => {
  await logIn(page, 'admin1');
  await expect(page.locator('.auth .roles')).toContainText('admin');

  // Admins manage the catalogue but do not place orders.
  const form = page.locator('app-product-form');
  await expect(form).toBeVisible();
  await expect(page.locator('app-cart')).toHaveCount(0);

  // The product is created the first time these tests run in an environment and reused after.
  await expect(page.locator('app-product-list > table tbody tr').first()).toBeVisible();
  if ((await productRow(page, E2E_PRODUCT.sku).count()) === 0) {
    await form.getByLabel('SKU').fill(E2E_PRODUCT.sku);
    await form.getByLabel('Name').fill(E2E_PRODUCT.name);
    await form.getByLabel('Price').fill(E2E_PRODUCT.price);
    await form.getByLabel('In stock').fill(E2E_PRODUCT.stock);
    await form.getByRole('button', { name: 'Add product' }).click();
  }

  await expect(productRow(page, E2E_PRODUCT.sku)).toContainText(E2E_PRODUCT.name);
  await expect(productRow(page, E2E_PRODUCT.sku)).toContainText('$12.50');
});

test('a customer logs in, places two orders and sees them under My orders', async ({ page }) => {
  await logIn(page, 'customer1');
  await expect(page.locator('.auth .roles')).toContainText('customer');
  await expect(page.locator('app-product-form')).toHaveCount(0);

  const stockCell = productRow(page, E2E_PRODUCT.sku).locator('td').nth(3);
  const stockBefore = Number(await stockCell.innerText());

  orderToDeliver = await placeOrder(page, 2);
  await expect(page.locator('app-cart .success')).toContainText('$25.00');
  // Placing the order took the two items out of stock, and the page shows it.
  await expect(stockCell).toHaveText(String(stockBefore - 2));

  orderToCancel = await placeOrder(page, 1);
  expect(orderToCancel).not.toBe(orderToDeliver);
  await expect(stockCell).toHaveText(String(stockBefore - 3));

  await page.getByRole('link', { name: 'My orders', exact: true }).click();
  await expect(page).toHaveURL(/\/orders$/);
  const card = orderCard(page, orderToDeliver);
  await expect(card.locator('.status')).toHaveText('placed');
  await expect(card).toContainText(`2 × ${E2E_PRODUCT.name}`);
  await expect(card.locator('footer')).toContainText('$25.00');
  await expect(orderCard(page, orderToCancel).locator('.status')).toHaveText('placed');
});

test('a customer who opens a staff page is sent back to the catalogue', async ({ page }) => {
  await logIn(page, 'customer1');

  for (const staffPage of ['/warehouse', '/reports']) {
    await page.goto(staffPage);

    await expect(page).toHaveURL(/\/products$/);
    await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
  }
});

test('warehouse staff move the order through packed, shipped and delivered', async ({ page }) => {
  await logIn(page, 'warehouse1');
  await expect(page.getByRole('button', { name: 'Add to order' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Orders', exact: true }).click();
  await expect(page).toHaveURL(/\/warehouse$/);

  const row = orderRow(page, orderToDeliver);
  await expect(row).toContainText('customer1');
  await expect(row).toContainText(`2 × ${E2E_PRODUCT.name}`);
  await expect(row.locator('.status')).toHaveText('placed');
  // Cancelling is for admins only.
  await expect(row.getByRole('button', { name: 'Cancel' })).toHaveCount(0);

  await row.getByRole('button', { name: 'Mark packed' }).click();
  await expect(row.locator('.status')).toHaveText('packed');

  await row.getByRole('button', { name: 'Mark shipped' }).click();
  await expect(row.locator('.status')).toHaveText('shipped');

  await row.getByRole('button', { name: 'Mark delivered' }).click();
  await expect(row.locator('.status')).toHaveText('delivered');

  // A delivered order has no next step.
  await expect(row.getByRole('button')).toHaveCount(0);
});

test('an admin cancels the other order', async ({ page }) => {
  await logIn(page, 'admin1');
  await page.getByRole('link', { name: 'Orders', exact: true }).click();

  const row = orderRow(page, orderToCancel);
  await expect(row.locator('.status')).toHaveText('placed');
  await row.getByRole('button', { name: 'Cancel' }).click();

  await expect(row.locator('.status')).toHaveText('cancelled');
  await expect(row.getByRole('button')).toHaveCount(0);
  // The delivered order can no longer be cancelled.
  await expect(orderRow(page, orderToDeliver).getByRole('button', { name: 'Cancel' })).toHaveCount(0);
});

test('an admin opens the reports and finds the sales just made', async ({ page }) => {
  await logIn(page, 'admin1');
  await page.getByRole('link', { name: 'Reports', exact: true }).click();
  await expect(page).toHaveURL(/\/reports$/);

  const tile = (label: string) =>
    page
      .locator('app-reports .tile')
      .filter({ has: page.getByText(label, { exact: true }) })
      .locator('.value');
  // The delivered order above counts; the cancelled one is reported separately.
  await expect(tile('Revenue')).toHaveText(/^\$[\d,]+\.\d{2}$/);
  expect(Number((await tile('Orders').innerText()).replace(/,/g, ''))).toBeGreaterThanOrEqual(1);
  expect(Number((await tile('Cancelled orders').innerText()).replace(/,/g, ''))).toBeGreaterThanOrEqual(1);

  // Fourteen days, the last of which is today and has this run's sale in it.
  const days = page.locator('app-reports .daily tbody tr');
  await expect(days).toHaveCount(14);
  expect(Number((await days.last().locator('td').nth(1).innerText()).replace(/,/g, ''))).toBeGreaterThanOrEqual(1);

  await expect(page.locator('app-reports .top-products tbody tr').first()).toBeVisible();
  await expect(page.locator('app-reports .low-stock .note')).toContainText('or fewer left');
});

test('the customer sees where both orders ended up, then logs out', async ({ page }) => {
  await logIn(page, 'customer1');
  await page.getByRole('link', { name: 'My orders', exact: true }).click();

  await expect(orderCard(page, orderToDeliver).locator('.status')).toHaveText('delivered');
  await expect(orderCard(page, orderToCancel).locator('.status')).toHaveText('cancelled');

  await page.getByRole('button', { name: 'Log out' }).click();

  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  await expect(page.locator('.auth .user')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'My orders', exact: true })).toHaveCount(0);
});
