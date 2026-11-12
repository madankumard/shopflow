package com.shopflow.product;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
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
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** Integration tests: the whole app against a real PostgreSQL started by Testcontainers. */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class ProductApiIntegrationTest {

	@Autowired
	private MockMvc mvc;

	private static RequestPostProcessor admin() {
		return jwt().authorities(new SimpleGrantedAuthority("ROLE_admin"));
	}

	@Test
	void migrationsSeedProducts() throws Exception {
		mvc.perform(get("/api/products"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[*].sku", hasItem("KB-001")));
	}

	@Test
	void createsAndReadsBackProduct() throws Exception {
		mvc.perform(post("/api/products").with(admin()).contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"sku": "HD-001", "name": "Headset", "price": 59.00, "stockQuantity": 25}
					"""))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.id").isNumber());

		mvc.perform(get("/api/products")).andExpect(jsonPath("$[*].sku", hasItem("HD-001")));

		mvc.perform(post("/api/products").with(admin()).contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"sku": "HD-001", "name": "Headset again", "price": 59.00, "stockQuantity": 1}
					"""))
			.andExpect(status().isConflict());
	}

	@Test
	void refusesToCreateWithoutLogin() throws Exception {
		mvc.perform(post("/api/products").contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"sku": "NO-001", "name": "Nobody", "price": 1.00, "stockQuantity": 1}
					"""))
			.andExpect(status().isUnauthorized());
	}

}
