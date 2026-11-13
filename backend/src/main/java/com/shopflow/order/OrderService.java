package com.shopflow.order;

import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.shopflow.product.Product;
import com.shopflow.product.ProductRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** The rules of ordering. Each method is one transaction: it all happens or none of it does. */
@Service
public class OrderService {

	private final OrderRepository orders;

	private final ProductRepository products;

	private final Clock clock;

	public OrderService(OrderRepository orders, ProductRepository products, Clock clock) {
		this.orders = orders;
		this.products = products;
		this.clock = clock;
	}

	/** Places an order and takes its items out of stock. */
	@Transactional
	public Order place(String customerUsername, PlaceOrderRequest request) {
		// The same product listed twice counts as one line with the quantities added up.
		Map<Long, Integer> quantities = request.lines()
			.stream()
			.collect(Collectors.toMap(PlaceOrderRequest.Line::productId, PlaceOrderRequest.Line::quantity,
					Integer::sum, LinkedHashMap::new));

		Map<Long, Product> found = products.findAllByIdForUpdate(quantities.keySet())
			.stream()
			.collect(Collectors.toMap(Product::getId, Function.identity()));

		Order order = new Order(customerUsername, clock.instant());
		quantities.forEach((productId, quantity) -> {
			Product product = found.get(productId);
			if (product == null) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown product " + productId);
			}
			if (!product.hasInStock(quantity)) {
				throw new ResponseStatusException(HttpStatus.CONFLICT, "Only " + product.getStockQuantity()
						+ " of " + product.getName() + " in stock");
			}
			product.removeStock(quantity);
			order.addLine(product, quantity);
		});
		return orders.save(order);
	}

	@Transactional(readOnly = true)
	public List<Order> placedBy(String customerUsername) {
		return orders.findByCustomerUsernameOrderByCreatedAtDescIdDesc(customerUsername);
	}

	/** Every order, newest first; optionally only those in one status. */
	@Transactional(readOnly = true)
	public List<Order> all(OrderStatus status) {
		return status == null ? orders.findAllByOrderByCreatedAtDescIdDesc()
				: orders.findByStatusOrderByCreatedAtDescIdDesc(status);
	}

	/**
	 * One order. Staff may see any; a customer only their own. Someone else's order is
	 * reported as not found, so order numbers cannot be probed.
	 */
	@Transactional(readOnly = true)
	public Order get(Long id, String username, boolean staff) {
		Order order = find(id);
		if (!staff && !order.getCustomerUsername().equals(username)) {
			throw notFound();
		}
		order.getLines().size(); // load the lines while the transaction is open
		return order;
	}

	/** Moves an order to its next step: packed, shipped, then delivered. */
	@Transactional
	public Order advance(Long id) {
		Order order = find(id);
		OrderStatus next = order.getStatus()
			.next()
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
					"An order that is " + order.getStatus() + " cannot move any further"));
		order.moveTo(next, clock.instant());
		order.getLines().size();
		return order;
	}

	/** Cancels an order that has not left the warehouse and puts its items back in stock. */
	@Transactional
	public Order cancel(Long id) {
		Order order = find(id);
		if (!order.getStatus().canBeCancelled()) {
			throw new ResponseStatusException(HttpStatus.CONFLICT,
					"An order that is " + order.getStatus() + " can no longer be cancelled");
		}
		Map<Long, Integer> quantities = order.getLines()
			.stream()
			.collect(Collectors.toMap(OrderLine::getProductId, OrderLine::getQuantity, Integer::sum));
		products.findAllByIdForUpdate(quantities.keySet())
			.forEach(product -> product.addStock(quantities.get(product.getId())));
		order.moveTo(OrderStatus.CANCELLED, clock.instant());
		return order;
	}

	private Order find(Long id) {
		return orders.findById(id).orElseThrow(OrderService::notFound);
	}

	private static ResponseStatusException notFound() {
		return new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
	}

}
