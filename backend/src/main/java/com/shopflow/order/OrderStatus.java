package com.shopflow.order;

import java.util.Optional;

/**
 * The life of an order. It moves forward one step at a time:
 * PLACED, PACKED, SHIPPED, DELIVERED. It can be cancelled until it has left the warehouse.
 */
public enum OrderStatus {

	PLACED, PACKED, SHIPPED, DELIVERED, CANCELLED;

	/** The step the warehouse takes next, or empty when the order is finished. */
	public Optional<OrderStatus> next() {
		return switch (this) {
			case PLACED -> Optional.of(PACKED);
			case PACKED -> Optional.of(SHIPPED);
			case SHIPPED -> Optional.of(DELIVERED);
			case DELIVERED, CANCELLED -> Optional.empty();
		};
	}

	/** Only while the goods are still in the warehouse. */
	public boolean canBeCancelled() {
		return this == PLACED || this == PACKED;
	}

}
