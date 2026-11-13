import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Order, OrderService } from './order.service';

/** A customer's own orders and where each one has got to. */
@Component({
  selector: 'app-my-orders',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './my-orders.html',
  styleUrl: './orders.scss',
})
export class MyOrders implements OnInit {
  private readonly orderService = inject(OrderService);

  protected readonly orders = signal<Order[]>([]);
  protected readonly status = signal<'loading' | 'ready' | 'error'>('loading');

  ngOnInit(): void {
    this.orderService.mine().subscribe({
      next: (orders) => {
        this.orders.set(orders);
        this.status.set('ready');
      },
      error: () => this.status.set('error'),
    });
  }
}
