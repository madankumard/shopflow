package com.shopflow.order;

import java.util.List;

import com.shopflow.security.SecurityConfig;
import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Who may call each of these is decided in {@link SecurityConfig}. */
@RestController
@RequestMapping("/api/orders")
public class OrderController {

	private final OrderService orders;

	public OrderController(OrderService orders) {
		this.orders = orders;
	}

	/** Customers: place an order. */
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public OrderResponse place(@AuthenticationPrincipal Jwt user, @Valid @RequestBody PlaceOrderRequest request) {
		return OrderResponse.from(orders.place(username(user), request));
	}

	/** Customers: their own orders. */
	@GetMapping("/mine")
	public List<OrderResponse> mine(@AuthenticationPrincipal Jwt user) {
		return orders.placedBy(username(user)).stream().map(OrderResponse::from).toList();
	}

	/** Warehouse and admins: every order, optionally filtered by status. */
	@GetMapping
	public List<OrderResponse> all(@RequestParam(required = false) OrderStatus status) {
		return orders.all(status).stream().map(OrderResponse::from).toList();
	}

	/** Any logged-in user, but a customer only gets their own order. */
	@GetMapping("/{id}")
	public OrderResponse get(@PathVariable Long id, @AuthenticationPrincipal Jwt user,
			Authentication authentication) {
		return OrderResponse.from(orders.get(id, username(user), isStaff(authentication)));
	}

	/** Warehouse and admins: move an order to its next step. */
	@PostMapping("/{id}/advance")
	public OrderResponse advance(@PathVariable Long id) {
		return OrderResponse.from(orders.advance(id));
	}

	/** Admins: cancel an order that has not shipped. */
	@PostMapping("/{id}/cancel")
	public OrderResponse cancel(@PathVariable Long id) {
		return OrderResponse.from(orders.cancel(id));
	}

	private static String username(Jwt user) {
		return user.getClaimAsString("preferred_username");
	}

	private static boolean isStaff(Authentication authentication) {
		return authentication.getAuthorities()
			.stream()
			.anyMatch(authority -> authority.getAuthority().equals("ROLE_" + SecurityConfig.WAREHOUSE)
					|| authority.getAuthority().equals("ROLE_" + SecurityConfig.ADMIN));
	}

}
