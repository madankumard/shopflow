package com.shopflow.product;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ProductRequest(
		@NotBlank String sku,
		@NotBlank String name,
		@NotNull @DecimalMin("0.00") BigDecimal price,
		@Min(0) int stockQuantity) {
}
