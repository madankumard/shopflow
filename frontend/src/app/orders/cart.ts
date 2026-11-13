import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartItem, CartService } from './cart.service';
import { Order, OrderService } from './order.service';

/** The customer's order in the making, shown under the catalogue, with the Place order button. */
@Component({
  selector: 'app-cart',
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './cart.html',
  styleUrl: './cart.scss',
})
export class Cart {
  private readonly orderService = inject(OrderService);
  protected readonly cart = inject(CartService);

  /** Emitted after an order goes through or is refused: either way, stock levels have moved. */
  readonly stockChanged = output<void>();

  protected readonly placing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly placed = signal<Order | null>(null);

  protected changeQuantity(item: CartItem, value: string): void {
    this.cart.setQuantity(item.product, Number(value));
  }

  protected place(): void {
    if (this.cart.isEmpty() || this.placing()) {
      return;
    }
    this.placing.set(true);
    this.error.set(null);
    this.placed.set(null);
    const lines = this.cart
      .items()
      .map((item) => ({ productId: item.product.id, quantity: item.quantity }));
    this.orderService.place(lines).subscribe({
      next: (order) => {
        this.placing.set(false);
        this.placed.set(order);
        this.cart.clear();
        this.stockChanged.emit();
      },
      error: (response: HttpErrorResponse) => {
        this.placing.set(false);
        this.error.set(describe(response));
        if (response.status === 409) {
          this.stockChanged.emit();
        }
      },
    });
  }
}

function describe(response: HttpErrorResponse): string {
  switch (response.status) {
    case 409:
      return 'Something in your order is no longer in stock in that quantity. The stock numbers above have been refreshed; adjust your order and try again.';
    case 401:
    case 403:
      return 'Only a logged-in customer can place an order.';
    default:
      return 'Could not place the order. Try again.';
  }
}
