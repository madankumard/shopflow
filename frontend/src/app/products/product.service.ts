import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface Product {
  id: number;
  sku: string;
  name: string;
  price: number;
  stockQuantity: number;
}

export type NewProduct = Omit<Product, 'id'>;

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);

  list(): Observable<Product[]> {
    return this.http.get<Product[]>('/api/products');
  }

  /** Admins only; the backend refuses anyone else. */
  create(product: NewProduct): Observable<Product> {
    return this.http.post<Product>('/api/products', product);
  }
}
