package com.shopflow.order;

import java.util.List;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<Order, Long> {

	// The entity graph loads each order's lines in the same query.
	@EntityGraph(attributePaths = "lines")
	List<Order> findByCustomerUsernameOrderByCreatedAtDescIdDesc(String customerUsername);

	@EntityGraph(attributePaths = "lines")
	List<Order> findAllByOrderByCreatedAtDescIdDesc();

	@EntityGraph(attributePaths = "lines")
	List<Order> findByStatusOrderByCreatedAtDescIdDesc(OrderStatus status);

}
