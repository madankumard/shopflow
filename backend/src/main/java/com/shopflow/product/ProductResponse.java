package com.shopflow.product;

import java.math.BigDecimal;

public record ProductResponse(Long id, String sku, String name, BigDecimal price, int stockQuantity) {

	static ProductResponse from(Product product) {
		return new ProductResponse(product.getId(), product.getSku(), product.getName(), product.getPrice(),
				product.getStockQuantity());
	}

}
