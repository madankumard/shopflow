import { Locator, Page, expect } from '@playwright/test';

export type TestUser = 'customer1' | 'warehouse1' | 'admin1';

/** The product every run orders. It is created once per environment with stock to last. */
export const E2E_PRODUCT = { sku: 'E2E-001', name: 'End-to-end test item', price: '12.50', stock: '100000' };

function password(): string {
  const value = process.env.E2E_USER_PASSWORD;
  if (!value) {
    throw new Error('E2E_USER_PASSWORD is not set. Run the tests through infra/e2e-test.ps1.');
  }
  return value;
}

/** Opens the catalogue and waits until the app knows whether anyone is logged in. */
export async function openApp(page: Page): Promise<void> {
  await page.goto('/products');
  await expect(page.locator('.auth button')).toBeVisible();
}

/** Logs in through Keycloak's own login page, as a person would. */
export async function logIn(page: Page, user: TestUser): Promise<void> {
  await openApp(page);
  await page.getByRole('button', { name: 'Log in' }).click();

  // The browser is now on Keycloak, under the same address at /auth.
  await expect(page).toHaveURL(/\/auth\/realms\/shopflow\//);
  await page.locator('#username').fill(user);
  await page.locator('#password').fill(password());
  await page.locator('#kc-login').click();

  // Back in ShopFlow, with the user's name in the header.
  await expect(page.locator('.auth .user')).toContainText(user);
}

/** The catalogue row for a product, found by its SKU. */
export function productRow(page: Page, sku: string): Locator {
  return page.locator('app-product-list > table tbody tr').filter({ hasText: sku });
}

/** The row for an order on the warehouse's Orders page. */
export function orderRow(page: Page, orderNumber: number): Locator {
  return page
    .locator('app-warehouse-orders tbody tr')
    .filter({ has: page.getByRole('cell', { name: `#${orderNumber}`, exact: true }) });
}

/** A customer's order card on the My orders page. */
export function orderCard(page: Page, orderNumber: number): Locator {
  return page
    .locator('app-my-orders .order')
    .filter({ has: page.getByText(`Order #${orderNumber}`, { exact: true }) });
}

/** Adds the test product to the order the given number of times and places the order. */
export async function placeOrder(page: Page, quantity: number): Promise<number> {
  const row = productRow(page, E2E_PRODUCT.sku);
  for (let i = 0; i < quantity; i++) {
    await row.getByRole('button', { name: 'Add to order' }).click();
  }
  const cart = page.locator('app-cart');
  await expect(cart.getByLabel(`Quantity of ${E2E_PRODUCT.name}`)).toHaveValue(String(quantity));

  // Take the order number from the server's answer, then check the page shows that same one.
  // Reading it off the page alone could pick up the confirmation of an earlier order.
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.request().method() === 'POST' && new URL(candidate.url()).pathname === '/api/orders',
    ),
    cart.getByRole('button', { name: 'Place order' }).click(),
  ]);
  expect(response.status()).toBe(201);
  const orderNumber = (await response.json()).id as number;

  await expect(cart.locator('.success')).toContainText(`Order #${orderNumber} placed`);
  return orderNumber;
}
