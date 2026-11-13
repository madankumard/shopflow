import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { NEXT_STEP, Order, OrderService, canBeCancelled } from './order.service';

/** Every order, for the warehouse to work through and for admins to cancel. */
@Component({
  selector: 'app-warehouse-orders',
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './warehouse-orders.html',
  styleUrl: './orders.scss',
})
export class WarehouseOrders implements OnInit {
  private readonly orderService = inject(OrderService);
  protected readonly auth = inject(AuthService);

  protected readonly orders = signal<Order[]>([]);
  protected readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  /** The order a button was just pressed for, so its buttons can be disabled meanwhile. */
  protected readonly busy = signal<number | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly nextStep = NEXT_STEP;
  protected readonly canBeCancelled = canBeCancelled;

  ngOnInit(): void {
    this.load();
  }

  protected advance(order: Order): void {
    this.change(order, this.orderService.advance(order.id));
  }

  protected cancel(order: Order): void {
    this.change(order, this.orderService.cancel(order.id));
  }

  private load(): void {
    this.orderService.all().subscribe({
      next: (orders) => {
        this.orders.set(orders);
        this.status.set('ready');
      },
      error: () => this.status.set('error'),
    });
  }

  private change(order: Order, request: Observable<Order>): void {
    if (this.busy() !== null) {
      return;
    }
    this.busy.set(order.id);
    this.error.set(null);
    request.subscribe({
      next: (updated) => {
        this.busy.set(null);
        this.orders.update((orders) => orders.map((o) => (o.id === updated.id ? updated : o)));
      },
      error: (response: HttpErrorResponse) => {
        this.busy.set(null);
        if (response.status === 409) {
          // Someone else got there first; show what the order looks like now.
          this.error.set(`Order #${order.id} had already changed. The list has been refreshed.`);
          this.load();
        } else {
          this.error.set(`Could not update order #${order.id}. Try again.`);
        }
      },
    });
  }
}
