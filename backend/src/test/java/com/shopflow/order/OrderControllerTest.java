package com.shopflow.order;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import com.shopflow.product.Product;
import com.shopflow.security.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** Unit tests: the web layer and its access rules, with the ordering rules mocked. */
@WebMvcTest(OrderController.class)
@Import(SecurityConfig.class)
class OrderControllerTest {

	private static final String ONE_KEYBOARD = """
			{"lines": [{"productId": 1, "quantity": 2}]}
			""";

	@Autowired
	private MockMvc mvc;

	@MockitoBean
	private OrderService orders;

	@MockitoBean
	private JwtDecoder jwtDecoder;

	private static RequestPostProcessor user(String username, String role) {
		return jwt().jwt(token -> token.claim("preferred_username", username))
			.authorities(new SimpleGrantedAuthority("ROLE_" + role));
	}

	private static Order sampleOrder(String customer) {
		Order order = new Order(customer, Instant.parse("2026-11-13T10:00:00Z"));
		order.addLine(new Product("KB-001", "Keyboard", new BigDecimal("79.99"), 40), 2);
		return order;
	}

	// --- placing an order

	@Test
	void customerPlacesOrderUnderTheirOwnName() throws Exception {
		given(orders.place(eq("casey"), any())).willReturn(sampleOrder("casey"));

		mvc.perform(post("/api/orders").with(user("casey", "customer"))
			.contentType(MediaType.APPLICATION_JSON)
			.content(ONE_KEYBOARD))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.customer").value("casey"))
			.andExpect(jsonPath("$.status").value("PLACED"))
			.andExpect(jsonPath("$.total").value(159.98))
			.andExpect(jsonPath("$.lines[0].productName").value("Keyboard"))
			.andExpect(jsonPath("$.lines[0].lineTotal").value(159.98));
	}

	@Test
	void refusesToPlaceWithoutLogin() throws Exception {
		mvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON).content(ONE_KEYBOARD))
			.andExpect(status().isUnauthorized());

		verifyNoInteractions(orders);
	}

	@ParameterizedTest
	@ValueSource(strings = { "warehouse", "admin" })
	void onlyCustomersPlaceOrders(String role) throws Exception {
		mvc.perform(post("/api/orders").with(user("someone", role))
			.contentType(MediaType.APPLICATION_JSON)
			.content(ONE_KEYBOARD))
			.andExpect(status().isForbidden());

		verifyNoInteractions(orders);
	}

	@ParameterizedTest
	@ValueSource(strings = { """
			{"lines": []}
			""", """
			{"lines": [{"productId": 1, "quantity": 0}]}
			""", """
			{"lines": [{"quantity": 1}]}
			""", "{}" })
	void rejectsAnOrderThatIsEmptyOrMalformed(String body) throws Exception {
		mvc.perform(post("/api/orders").with(user("casey", "customer"))
			.contentType(MediaType.APPLICATION_JSON)
			.content(body)).andExpect(status().isBadRequest());

		verifyNoInteractions(orders);
	}

	// --- a customer's own orders

	@Test
	void customerListsTheirOwnOrders() throws Exception {
		given(orders.placedBy("casey")).willReturn(List.of(sampleOrder("casey")));

		mvc.perform(get("/api/orders/mine").with(user("casey", "customer")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].customer").value("casey"));
	}

	@Test
	void ownOrdersNeedACustomerLogin() throws Exception {
		mvc.perform(get("/api/orders/mine")).andExpect(status().isUnauthorized());
		mvc.perform(get("/api/orders/mine").with(user("wren", "warehouse"))).andExpect(status().isForbidden());
	}

	// --- all orders

	@ParameterizedTest
	@ValueSource(strings = { "warehouse", "admin" })
	void staffListAllOrders(String role) throws Exception {
		given(orders.all(null)).willReturn(List.of(sampleOrder("casey")));

		mvc.perform(get("/api/orders").with(user("someone", role)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].customer").value("casey"));
	}

	@Test
	void staffFilterOrdersByStatus() throws Exception {
		given(orders.all(OrderStatus.PACKED)).willReturn(List.of());

		mvc.perform(get("/api/orders?status=PACKED").with(user("wren", "warehouse")))
			.andExpect(status().isOk());

		verify(orders).all(OrderStatus.PACKED);
	}

	@Test
	void customersCannotListAllOrders() throws Exception {
		mvc.perform(get("/api/orders")).andExpect(status().isUnauthorized());
		mvc.perform(get("/api/orders").with(user("casey", "customer"))).andExpect(status().isForbidden());

		verifyNoInteractions(orders);
	}

	// --- one order

	@Test
	void customerAsksForAnOrderAsANonStaffUser() throws Exception {
		given(orders.get(7L, "casey", false)).willReturn(sampleOrder("casey"));

		mvc.perform(get("/api/orders/7").with(user("casey", "customer"))).andExpect(status().isOk());

		verify(orders).get(7L, "casey", false);
	}

	@ParameterizedTest
	@ValueSource(strings = { "warehouse", "admin" })
	void staffAskForAnOrderAsStaff(String role) throws Exception {
		given(orders.get(7L, "someone", true)).willReturn(sampleOrder("casey"));

		mvc.perform(get("/api/orders/7").with(user("someone", role))).andExpect(status().isOk());

		verify(orders).get(7L, "someone", true);
	}

	@Test
	void oneOrderNeedsALogin() throws Exception {
		mvc.perform(get("/api/orders/7")).andExpect(status().isUnauthorized());
	}

	// --- moving an order on

	@ParameterizedTest
	@ValueSource(strings = { "warehouse", "admin" })
	void staffAdvanceAnOrder(String role) throws Exception {
		Order packed = sampleOrder("casey");
		packed.moveTo(OrderStatus.PACKED, Instant.parse("2026-11-13T11:00:00Z"));
		given(orders.advance(7L)).willReturn(packed);

		mvc.perform(post("/api/orders/7/advance").with(user("someone", role)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("PACKED"));
	}

	@Test
	void customersCannotAdvanceAnOrder() throws Exception {
		mvc.perform(post("/api/orders/7/advance")).andExpect(status().isUnauthorized());
		mvc.perform(post("/api/orders/7/advance").with(user("casey", "customer")))
			.andExpect(status().isForbidden());

		verifyNoInteractions(orders);
	}

	// --- cancelling

	@Test
	void adminCancelsAnOrder() throws Exception {
		Order cancelled = sampleOrder("casey");
		cancelled.moveTo(OrderStatus.CANCELLED, Instant.parse("2026-11-13T11:00:00Z"));
		given(orders.cancel(7L)).willReturn(cancelled);

		mvc.perform(post("/api/orders/7/cancel").with(user("alex", "admin")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("CANCELLED"));
	}

	@ParameterizedTest
	@ValueSource(strings = { "customer", "warehouse" })
	void onlyAdminsCancel(String role) throws Exception {
		mvc.perform(post("/api/orders/7/cancel").with(user("someone", role))).andExpect(status().isForbidden());

		verifyNoInteractions(orders);
	}

	@Test
	void cancellingNeedsALogin() throws Exception {
		mvc.perform(post("/api/orders/7/cancel")).andExpect(status().isUnauthorized());
	}

}
