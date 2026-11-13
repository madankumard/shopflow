import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type OrderStatus = 'PLACED' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface OrderLine {
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Order {
  id: number;
  customer: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  updatedAt: string;
  lines: OrderLine[];
}

export interface NewOrderLine {
  productId: number;
  quantity: number;
}

/** The step the warehouse takes next for each status; finished orders have none. */
export const NEXT_STEP: Partial<Record<OrderStatus, string>> = {
  PLACED: 'Mark packed',
  PACKED: 'Mark shipped',
  SHIPPED: 'Mark delivered',
};

/** An order can be cancelled only while it is still in the warehouse. */
export function canBeCancelled(order: Order): boolean {
  return order.status === 'PLACED' || order.status === 'PACKED';
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);

  /** Customers. */
  place(lines: NewOrderLine[]): Observable<Order> {
    return this.http.post<Order>('/api/orders', { lines });
  }

  /** Customers: their own orders, newest first. */
  mine(): Observable<Order[]> {
    return this.http.get<Order[]>('/api/orders/mine');
  }

  /** Warehouse and admins: every order, newest first. */
  all(): Observable<Order[]> {
    return this.http.get<Order[]>('/api/orders');
  }

  /** Warehouse and admins: move an order to its next step. */
  advance(id: number): Observable<Order> {
    return this.http.post<Order>(`/api/orders/${id}/advance`, null);
  }

  /** Admins. */
  cancel(id: number): Observable<Order> {
    return this.http.post<Order>(`/api/orders/${id}/cancel`, null);
  }
}
