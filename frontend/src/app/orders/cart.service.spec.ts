import { TestBed } from '@angular/core/testing';
import { Product } from '../products/product.service';
import { CartService } from './cart.service';

describe('CartService', () => {
  const keyboard: Product = { id: 1, sku: 'KB-001', name: 'Keyboard', price: 79.99, stockQuantity: 3 };
  const mouse: Product = { id: 2, sku: 'MS-001', name: 'Mouse', price: 24.5, stockQuantity: 10 };
  const soldOut: Product = { id: 3, sku: 'MN-001', name: 'Monitor', price: 229, stockQuantity: 0 };
  let cart: CartService;

  beforeEach(() => {
    cart = TestBed.inject(CartService);
  });

  it('starts empty', () => {
    expect(cart.isEmpty()).toBe(true);
    expect(cart.total()).toBe(0);
  });

  it('adds one at a time and totals price times quantity', () => {
    cart.add(keyboard);
    cart.add(keyboard);
    cart.add(mouse);

    expect(cart.items().map((item) => [item.product.name, item.quantity])).toEqual([
      ['Keyboard', 2],
      ['Mouse', 1],
    ]);
    expect(cart.total()).toBeCloseTo(184.48);
    expect(cart.isEmpty()).toBe(false);
  });

  it('never holds more than is in stock', () => {
    for (let i = 0; i < 5; i++) {
      cart.add(keyboard);
    }
    expect(cart.items()[0].quantity).toBe(3);

    cart.setQuantity(mouse, 50);
    expect(cart.items()[1].quantity).toBe(10);
  });

  it('keeps a quantity at one or more, whatever is typed', () => {
    cart.setQuantity(mouse, 0);
    expect(cart.items()[0].quantity).toBe(1);

    cart.setQuantity(mouse, -4);
    expect(cart.items()[0].quantity).toBe(1);

    cart.setQuantity(mouse, Number('abc'));
    expect(cart.items()[0].quantity).toBe(1);

    cart.setQuantity(mouse, 2.9);
    expect(cart.items()[0].quantity).toBe(2);
  });

  it('ignores a product that is out of stock', () => {
    cart.add(soldOut);

    expect(cart.isEmpty()).toBe(true);
  });

  it('removes a product and clears everything', () => {
    cart.add(keyboard);
    cart.add(mouse);

    cart.remove(keyboard.id);
    expect(cart.items().map((item) => item.product.name)).toEqual(['Mouse']);

    cart.clear();
    expect(cart.isEmpty()).toBe(true);
  });
});
