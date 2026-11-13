package com.shopflow.order;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record OrderResponse(Long id, String customer, OrderStatus status, BigDecimal total, Instant createdAt,
		Instant updatedAt, List<Line> lines) {

	public record Line(Long productId, String productName, BigDecimal unitPrice, int quantity,
			BigDecimal lineTotal) {
	}

	static OrderResponse from(Order order) {
		List<Line> lines = order.getLines()
			.stream()
			.map(line -> new Line(line.getProductId(), line.getProductName(), line.getUnitPrice(),
					line.getQuantity(), line.getLineTotal()))
			.toList();
		return new OrderResponse(order.getId(), order.getCustomerUsername(), order.getStatus(), order.getTotal(),
				order.getCreatedAt(), order.getUpdatedAt(), lines);
	}

}
