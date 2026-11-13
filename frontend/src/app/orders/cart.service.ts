import { Injectable, computed, signal } from '@angular/core';
import { Product } from '../products/product.service';

export interface CartItem {
  product: Product;
  quantity: number;
}

/** What the customer has picked so far. Kept in memory only: it is gone after a page reload. */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly entries = signal<CartItem[]>([]);

  readonly items = this.entries.asReadonly();
  readonly isEmpty = computed(() => this.entries().length === 0);
  readonly total = computed(() =>
    this.entries().reduce((sum, item) => sum + item.product.price * item.quantity, 0),
  );

  /** Adds one of the product, never more than is in stock. */
  add(product: Product): void {
    const existing = this.entries().find((item) => item.product.id === product.id);
    this.setQuantity(product, (existing?.quantity ?? 0) + 1);
  }

  /** Sets the quantity, kept between 1 and the stock level. */
  setQuantity(product: Product, quantity: number): void {
    if (product.stockQuantity < 1) {
      return;
    }
    const wanted = Math.min(Math.max(1, Math.floor(quantity) || 1), product.stockQuantity);
    const alreadyPicked = this.entries().some((item) => item.product.id === product.id);
    this.entries.set(
      alreadyPicked
        ? this.entries().map((item) =>
            item.product.id === product.id ? { product, quantity: wanted } : item,
          )
        : [...this.entries(), { product, quantity: wanted }],
    );
  }

  remove(productId: number): void {
    this.entries.set(this.entries().filter((item) => item.product.id !== productId));
  }

  clear(): void {
    this.entries.set([]);
  }
}
