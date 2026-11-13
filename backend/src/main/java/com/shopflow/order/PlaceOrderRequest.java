package com.shopflow.order;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public record PlaceOrderRequest(@NotEmpty List<@Valid Line> lines) {

	public record Line(@NotNull Long productId, @Min(1) int quantity) {
	}

}
