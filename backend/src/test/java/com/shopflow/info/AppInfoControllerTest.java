package com.shopflow.info;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.web.servlet.MockMvc;

/** Unit test: the web layer alone. */
@WebMvcTest(controllers = AppInfoController.class,
		properties = { "app.environment=qa", "app.version=abc1234", "app.banner=Test data only" })
class AppInfoControllerTest {

	@Autowired
	private MockMvc mvc;

	@Test
	void returnsConfiguredEnvironmentAndVersion() throws Exception {
		mvc.perform(get("/api/info"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.environment").value("qa"))
			.andExpect(jsonPath("$.version").value("abc1234"))
			.andExpect(jsonPath("$.banner").value("Test data only"));
	}

}
