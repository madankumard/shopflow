package com.shopflow.product;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.data.domain.Sort;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** Unit tests: the web layer alone, with the database mocked. */
@WebMvcTest(ProductController.class)
class ProductControllerTest {

	@Autowired
	private MockMvc mvc;

	@MockitoBean
	private ProductRepository products;

	@Test
	void listsProducts() throws Exception {
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
	void rejectsInvalidProduct() throws Exception {
		mvc.perform(post("/api/products").contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"sku": "", "name": "Keyboard", "price": -1, "stockQuantity": 5}
					"""))
			.andExpect(status().isBadRequest());

		verify(products, never()).save(any());
	}

	@Test
	void rejectsDuplicateSku() throws Exception {
		given(products.existsBySku("KB-001")).willReturn(true);

		mvc.perform(post("/api/products").contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"sku": "KB-001", "name": "Keyboard", "price": 79.99, "stockQuantity": 5}
					"""))
			.andExpect(status().isConflict());
	}

}
