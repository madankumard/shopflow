package com.shopflow.info;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.shopflow.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

/** Integration test: the whole app, started with no Config Server or Vault, as in local development. */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class AppInfoApiIntegrationTest {

	@Autowired
	private MockMvc mvc;

	@Test
	void fallsBackToLocalDefaults() throws Exception {
		mvc.perform(get("/api/info"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.environment").value("local"))
			.andExpect(jsonPath("$.version").value("dev"))
			.andExpect(jsonPath("$.banner").value(""));
	}

}
