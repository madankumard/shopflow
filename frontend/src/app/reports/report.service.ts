import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface ReportDay {
  /** A UTC day, as yyyy-mm-dd. */
  date: string;
  orders: number;
  revenue: number;
}

export interface ProductSales {
  productId: number;
  productName: string;
  unitsSold: number;
  revenue: number;
}

export interface LowStockProduct {
  id: number;
  sku: string;
  name: string;
  stockQuantity: number;
}

/** Sales figures count every order that was not cancelled. */
export interface Report {
  orders: number;
  revenue: number;
  cancelledOrders: number;
  daily: ReportDay[];
  topProducts: ProductSales[];
  lowStockThreshold: number;
  lowStock: LowStockProduct[];
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);

  /** Admins only. */
  get(): Observable<Report> {
    return this.http.get<Report>('/api/reports');
  }
}
