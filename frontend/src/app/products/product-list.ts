import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { Cart } from '../orders/cart';
import { CartService } from '../orders/cart.service';
import { ProductForm } from './product-form';
import { Product, ProductService } from './product.service';

@Component({
  selector: 'app-product-list',
  imports: [CurrencyPipe, ProductForm, Cart],
  templateUrl: './product-list.html',
  styleUrl: './product-list.scss',
})
export class ProductList implements OnInit {
  private readonly productService = inject(ProductService);
  protected readonly auth = inject(AuthService);
  protected readonly cart = inject(CartService);

  protected readonly products = signal<Product[]>([]);
  protected readonly status = signal<'loading' | 'ready' | 'error'>('loading');

  ngOnInit(): void {
    this.load();
  }

  /** Also called after a product is added or an order placed, to show the new rows and stock levels. */
  protected load(): void {
    this.productService.list().subscribe({
      next: (products) => {
        this.products.set(products);
        this.status.set('ready');
      },
      error: () => this.status.set('error'),
    });
  }
}
