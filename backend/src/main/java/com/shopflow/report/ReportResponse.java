package com.shopflow.report;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Everything the reports page shows. Sales figures count every order that was not cancelled.
 */
public record ReportResponse(long orders, BigDecimal revenue, long cancelledOrders, List<Day> daily,
		List<ProductSales> topProducts, int lowStockThreshold, List<LowStock> lowStock) {

	/** One day's sales; days are in UTC. Days without orders are included with zeros. */
	public record Day(LocalDate date, long orders, BigDecimal revenue) {
	}

	public record ProductSales(Long productId, String productName, long unitsSold, BigDecimal revenue) {
	}

	public record LowStock(Long id, String sku, String name, int stockQuantity) {
	}

}
