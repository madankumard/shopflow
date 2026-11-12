import { Routes } from '@angular/router';
import { ProductList } from './products/product-list';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'products' },
  { path: 'products', component: ProductList },
];
