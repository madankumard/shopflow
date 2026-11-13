package com.shopflow.product;

import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "product")
public class Product {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true)
	private String sku;

	@Column(nullable = false)
	private String name;

	@Column(nullable = false)
	private BigDecimal price;

	@Column(name = "stock_quantity", nullable = false)
	private int stockQuantity;

	protected Product() {
	}

	public Product(String sku, String name, BigDecimal price, int stockQuantity) {
		this.sku = sku;
		this.name = name;
		this.price = price;
		this.stockQuantity = stockQuantity;
	}

	public Long getId() {
		return id;
	}

	public String getSku() {
		return sku;
	}

	public String getName() {
		return name;
	}

	public BigDecimal getPrice() {
		return price;
	}

	public int getStockQuantity() {
		return stockQuantity;
	}

	public boolean hasInStock(int quantity) {
		return stockQuantity >= quantity;
	}

	/** Takes stock out for an order. The caller checks {@link #hasInStock} first. */
	public void removeStock(int quantity) {
		if (!hasInStock(quantity)) {
			throw new IllegalStateException("Not enough stock of " + sku);
		}
		stockQuantity -= quantity;
	}

	/** Puts stock back, for example when an order is cancelled. */
	public void addStock(int quantity) {
		stockQuantity += quantity;
	}

}
