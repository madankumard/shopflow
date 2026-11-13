package com.shopflow.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.util.UUID;

import com.jayway.jsonpath.JsonPath;
import com.shopflow.TestcontainersConfiguration;
import com.shopflow.product.Product;
import com.shopflow.product.ProductRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** Integration tests: the ordering rules against a real PostgreSQL started by Testcontainers. */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class OrderApiIntegrationTest {

	@Autowired
	private MockMvc mvc;

	@Autowired
	private ProductRepository products;

	private static RequestPostProcessor user(String username, String role) {
		return jwt().jwt(token -> token.claim("preferred_username", username))
			.authorities(new SimpleGrantedAuthority("ROLE_" + role));
	}

	/** Each test gets its own product, so stock numbers are not shared between tests. */
	private Product newProduct(String price, int stock) {
		String sku = "T-" + UUID.randomUUID().toString().substring(0, 8);
		return products.save(new Product(sku, "Test item " + sku, new BigDecimal(price), stock));
	}

	private int stockOf(Product product) {
		return products.findById(product.getId()).orElseThrow().getStockQuantity();
	}

	private static String orderFor(Product product, int quantity) {
		return """
				{"lines": [{"productId": %d, "quantity": %d}]}
				""".formatted(product.getId(), quantity);
	}

	private long place(String customer, Product product, int quantity) throws Exception {
		String body = mvc
			.perform(post("/api/orders").with(user(customer, "customer"))
				.contentType(MediaType.APPLICATION_JSON)
				.content(orderFor(product, quantity)))
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return ((Number) JsonPath.read(body, "$.id")).longValue();
	}

	@Test
	void placingAnOrderTakesStockAndRecordsThePriceAtThatMoment() throws Exception {
		Product keyboard = newProduct("79.99", 10);
		Product mouse = newProduct("24.50", 5);

		mvc.perform(post("/api/orders").with(user("casey", "customer"))
			.contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"lines": [{"productId": %d, "quantity": 2}, {"productId": %d, "quantity": 1},
					           {"productId": %d, "quantity": 1}]}
					""".formatted(keyboard.getId(), mouse.getId(), keyboard.getId())))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.customer").value("casey"))
			.andExpect(jsonPath("$.status").value("PLACED"))
			// The keyboard appears twice in the request and is merged into one line of 3.
			.andExpect(jsonPath("$.lines.length()").value(2))
			.andExpect(jsonPath("$.lines[0].quantity").value(3))
			.andExpect(jsonPath("$.lines[0].unitPrice").value(79.99))
			.andExpect(jsonPath("$.total").value(264.47));

		assertThat(stockOf(keyboard)).isEqualTo(7);
		assertThat(stockOf(mouse)).isEqualTo(4);
	}

	@Test
	void refusesAnOrderForMoreThanIsInStockAndTakesNothing() throws Exception {
		Product plenty = newProduct("10.00", 10);
		Product scarce = newProduct("10.00", 1);

		mvc.perform(post("/api/orders").with(user("casey", "customer"))
			.contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"lines": [{"productId": %d, "quantity": 4}, {"productId": %d, "quantity": 2}]}
					""".formatted(plenty.getId(), scarce.getId())))
			.andExpect(status().isConflict());

		// The whole order is refused: the line that could have been filled is rolled back too.
		assertThat(stockOf(plenty)).isEqualTo(10);
		assertThat(stockOf(scarce)).isEqualTo(1);
	}

	@Test
	void refusesAnOrderForAnUnknownProduct() throws Exception {
		mvc.perform(post("/api/orders").with(user("casey", "customer"))
			.contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"lines": [{"productId": 999999999, "quantity": 1}]}
					""")).andExpect(status().isBadRequest());
	}

	@Test
	void customersSeeOnlyTheirOwnOrders() throws Exception {
		Product item = newProduct("5.00", 10);
		String casey = "casey-" + UUID.randomUUID();
		String robin = "robin-" + UUID.randomUUID();
		long caseysOrder = place(casey, item, 1);
		long robinsOrder = place(robin, item, 1);

		mvc.perform(get("/api/orders/mine").with(user(casey, "customer")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.length()").value(1))
			.andExpect(jsonPath("$[0].id").value(caseysOrder));

		mvc.perform(get("/api/orders/" + caseysOrder).with(user(casey, "customer")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.lines[0].quantity").value(1));

		// Someone else's order looks exactly like one that does not exist.
		mvc.perform(get("/api/orders/" + robinsOrder).with(user(casey, "customer")))
			.andExpect(status().isNotFound());
		mvc.perform(get("/api/orders/999999999").with(user(casey, "customer"))).andExpect(status().isNotFound());
	}

	@Test
	void staffSeeEveryOrderAndCanFilterByStatus() throws Exception {
		Product item = newProduct("5.00", 10);
		int placed = (int) place("casey", item, 1);
		int packed = (int) place("robin", item, 1);
		mvc.perform(post("/api/orders/" + packed + "/advance").with(user("wren", "warehouse")))
			.andExpect(status().isOk());

		mvc.perform(get("/api/orders").with(user("wren", "warehouse")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[*].id", hasItem(placed)))
			.andExpect(jsonPath("$[*].id", hasItem(packed)));

		mvc.perform(get("/api/orders?status=PACKED").with(user("alex", "admin")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[*].id", hasItem(packed)))
			.andExpect(jsonPath("$[*].id", not(hasItem(placed))));

		mvc.perform(get("/api/orders/" + placed).with(user("wren", "warehouse")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.customer").value("casey"));
	}

	@Test
	void warehouseMovesAnOrderThroughEveryStepAndThenNoFurther() throws Exception {
		Product item = newProduct("5.00", 10);
		long id = place("casey", item, 2);

		for (String expected : new String[] { "PACKED", "SHIPPED", "DELIVERED" }) {
			mvc.perform(post("/api/orders/" + id + "/advance").with(user("wren", "warehouse")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value(expected))
				.andExpect(jsonPath("$.lines[0].quantity").value(2));
		}

		mvc.perform(post("/api/orders/" + id + "/advance").with(user("wren", "warehouse")))
			.andExpect(status().isConflict());
		// Delivered goods stay out of stock.
		assertThat(stockOf(item)).isEqualTo(8);
	}

	@Test
	void cancellingBeforeShippingPutsTheItemsBackInStock() throws Exception {
		Product item = newProduct("5.00", 10);
		long id = place("casey", item, 3);
		assertThat(stockOf(item)).isEqualTo(7);

		mvc.perform(post("/api/orders/" + id + "/cancel").with(user("alex", "admin")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("CANCELLED"));

		assertThat(stockOf(item)).isEqualTo(10);

		// A cancelled order is finished: it cannot be cancelled again or moved on.
		mvc.perform(post("/api/orders/" + id + "/cancel").with(user("alex", "admin")))
			.andExpect(status().isConflict());
		mvc.perform(post("/api/orders/" + id + "/advance").with(user("wren", "warehouse")))
			.andExpect(status().isConflict());
		assertThat(stockOf(item)).isEqualTo(10);
	}

	@Test
	void anOrderThatHasShippedCanNoLongerBeCancelled() throws Exception {
		Product item = newProduct("5.00", 10);
		long id = place("casey", item, 3);
		mvc.perform(post("/api/orders/" + id + "/advance").with(user("wren", "warehouse")));
		mvc.perform(post("/api/orders/" + id + "/advance").with(user("wren", "warehouse")))
			.andExpect(jsonPath("$.status").value("SHIPPED"));

		mvc.perform(post("/api/orders/" + id + "/cancel").with(user("alex", "admin")))
			.andExpect(status().isConflict());

		assertThat(stockOf(item)).isEqualTo(7);
	}

	@Test
	void unknownOrdersAreNotFound() throws Exception {
		mvc.perform(post("/api/orders/999999999/advance").with(user("wren", "warehouse")))
			.andExpect(status().isNotFound());
		mvc.perform(post("/api/orders/999999999/cancel").with(user("alex", "admin")))
			.andExpect(status().isNotFound());
	}

}
