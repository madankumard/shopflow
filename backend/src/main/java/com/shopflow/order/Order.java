package com.shopflow.order;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import com.shopflow.product.Product;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

@Entity
@Table(name = "customer_order")
public class Order {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "customer_username", nullable = false)
	private String customerUsername;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private OrderStatus status;

	@Column(nullable = false)
	private BigDecimal total;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("id")
	private List<OrderLine> lines = new ArrayList<>();

	protected Order() {
	}

	Order(String customerUsername, Instant now) {
		this.customerUsername = customerUsername;
		this.status = OrderStatus.PLACED;
		this.total = BigDecimal.ZERO;
		this.createdAt = now;
		this.updatedAt = now;
	}

	void addLine(Product product, int quantity) {
		OrderLine line = new OrderLine(this, product, quantity);
		lines.add(line);
		total = total.add(line.getLineTotal());
	}

	void moveTo(OrderStatus newStatus, Instant now) {
		this.status = newStatus;
		this.updatedAt = now;
	}

	public Long getId() {
		return id;
	}

	public String getCustomerUsername() {
		return customerUsername;
	}

	public OrderStatus getStatus() {
		return status;
	}

	public BigDecimal getTotal() {
		return total;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

	public List<OrderLine> getLines() {
		return Collections.unmodifiableList(lines);
	}

}
