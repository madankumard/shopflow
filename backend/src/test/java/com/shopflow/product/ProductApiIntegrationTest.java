package com.shopflow.product;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.shopflow.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/** Integration tests: the whole app against a real PostgreSQL started by Testcontainers. */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class ProductApiIntegrationTest {

	@Autowired
	private MockMvc mvc;

	@Test
	void migrationsSeedProducts() throws Exception {
		mvc.perform(get("/api/products"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[*].sku", hasItem("KB-001")));
	}

	@Test
	void createsAndReadsBackProduct() throws Exception {
		mvc.perform(post("/api/products").contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"sku": "HD-001", "name": "Headset", "price": 59.00, "stockQuantity": 25}
					"""))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.id").isNumber());

		mvc.perform(get("/api/products")).andExpect(jsonPath("$[*].sku", hasItem("HD-001")));

		mvc.perform(post("/api/products").contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"sku": "HD-001", "name": "Headset again", "price": 59.00, "stockQuantity": 1}
					"""))
			.andExpect(status().isConflict());
	}

}
