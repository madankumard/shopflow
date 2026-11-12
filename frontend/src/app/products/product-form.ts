import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Product, ProductService } from './product.service';

/** Adds a product to the catalogue. Shown to admins only; the backend enforces the rule. */
@Component({
  selector: 'app-product-form',
  imports: [ReactiveFormsModule],
  templateUrl: './product-form.html',
  styleUrl: './product-form.scss',
})
export class ProductForm {
  private readonly productService = inject(ProductService);

  readonly created = output<Product>();

  protected readonly form = inject(FormBuilder).nonNullable.group({
    sku: ['', Validators.required],
    name: ['', Validators.required],
    price: [0, [Validators.required, Validators.min(0)]],
    stockQuantity: [0, [Validators.required, Validators.min(0)]],
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.productService.create(this.form.getRawValue()).subscribe({
      next: (product) => {
        this.saving.set(false);
        this.form.reset();
        this.created.emit(product);
      },
      error: (response: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(describe(response));
      },
    });
  }
}

function describe(response: HttpErrorResponse): string {
  switch (response.status) {
    case 400:
      return 'Check the values: every field is required and numbers cannot be negative.';
    case 401:
    case 403:
      return 'Only an admin can add products. Log in as an admin and try again.';
    case 409:
      return 'A product with this SKU already exists.';
    default:
      return 'Could not save the product. Try again.';
  }
}
