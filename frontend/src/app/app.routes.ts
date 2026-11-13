import { Routes } from '@angular/router';
import { roleGuard } from './auth/role.guard';
import { MyOrders } from './orders/my-orders';
import { WarehouseOrders } from './orders/warehouse-orders';
import { ProductList } from './products/product-list';
import { Reports } from './reports/reports';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'products' },
  { path: 'products', component: ProductList },
  { path: 'orders', component: MyOrders, canActivate: [roleGuard('customer')] },
  { path: 'warehouse', component: WarehouseOrders, canActivate: [roleGuard('warehouse', 'admin')] },
  { path: 'reports', component: Reports, canActivate: [roleGuard('admin')] },
  { path: '**', redirectTo: 'products' },
];
