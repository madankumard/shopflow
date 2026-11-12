package com.shopflow.product;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import com.shopflow.security.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Sort;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** Unit tests: the web layer and its access rules, with the database and Keycloak mocked. */
@WebMvcTest(ProductController.class)
@Import(SecurityConfig.class)
class ProductControllerTest {

	@Autowired
	private MockMvc mvc;

	@MockitoBean
	private ProductRepository products;

	/** Tokens are supplied ready-made by the tests, so nothing needs decoding. */
	@MockitoBean
	private JwtDecoder jwtDecoder;

	private static RequestPostProcessor userWithRole(String role) {
		return jwt().authorities(new SimpleGrantedAuthority("ROLE_" + role));
	}

	@Test
	void anyoneCanListProducts() throws Exception {
		given(products.findAll(any(Sort.class)))
			.willReturn(List.of(new Product("KB-001", "Keyboard", new BigDecimal("79.99"), 40)));

		mvc.perform(get("/api/products"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].sku").value("KB-001"))
			.andExpect(jsonPath("$[0].stockQuantity").value(40));
	}

	@Test
	void returns404ForUnknownProduct() throws Exception {
		given(products.findById(99L)).willReturn(Optional.empty());

		mvc.perform(get("/api/products/99")).andExpect(status().isNotFound());
	}

	@Test
	void refusesToCreateWithoutLogin() throws Exception {
		mvc.perform(post("/api/products").contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"sku": "KB-002", "name": "Keyboard", "price": 79.99, "stockQuantity": 5}
					"""))
			.andExpect(status().isUnauthorized());

		verify(products, never()).save(any());
	}

	@Test
	void refusesToCreateForNonAdmins() throws Exception {
		mvc.perform(post("/api/products").with(userWithRole("customer"))
			.contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"sku": "KB-002", "name": "Keyboard", "price": 79.99, "stockQuantity": 5}
					"""))
			.andExpect(status().isForbidden());

		verify(products, never()).save(any());
	}

	@Test
	void adminCreatesProduct() throws Exception {
		given(products.save(any(Product.class))).willAnswer(invocation -> invocation.getArgument(0));

		mvc.perform(post("/api/products").with(userWithRole("admin"))
			.contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"sku": "KB-002", "name": "Keyboard", "price": 79.99, "stockQuantity": 5}
					"""))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.sku").value("KB-002"));
	}

	@Test
	void rejectsInvalidProduct() throws Exception {
		mvc.perform(post("/api/products").with(userWithRole("admin"))
			.contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"sku": "", "name": "Keyboard", "price": -1, "stockQuantity": 5}
					"""))
			.andExpect(status().isBadRequest());

		verify(products, never()).save(any());
	}

	@Test
	void rejectsDuplicateSku() throws Exception {
		given(products.existsBySku("KB-001")).willReturn(true);

		mvc.perform(post("/api/products").with(userWithRole("admin"))
			.contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"sku": "KB-001", "name": "Keyboard", "price": 79.99, "stockQuantity": 5}
					"""))
			.andExpect(status().isConflict());
	}

}
