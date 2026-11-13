package com.shopflow.order;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class OrderStatusTest {

	@Test
	void movesForwardOneStepAtATime() {
		assertThat(OrderStatus.PLACED.next()).contains(OrderStatus.PACKED);
		assertThat(OrderStatus.PACKED.next()).contains(OrderStatus.SHIPPED);
		assertThat(OrderStatus.SHIPPED.next()).contains(OrderStatus.DELIVERED);
	}

	@Test
	void finishedOrdersGoNoFurther() {
		assertThat(OrderStatus.DELIVERED.next()).isEmpty();
		assertThat(OrderStatus.CANCELLED.next()).isEmpty();
	}

	@Test
	void canBeCancelledOnlyBeforeShipping() {
		assertThat(OrderStatus.PLACED.canBeCancelled()).isTrue();
		assertThat(OrderStatus.PACKED.canBeCancelled()).isTrue();
		assertThat(OrderStatus.SHIPPED.canBeCancelled()).isFalse();
		assertThat(OrderStatus.DELIVERED.canBeCancelled()).isFalse();
		assertThat(OrderStatus.CANCELLED.canBeCancelled()).isFalse();
	}

}
