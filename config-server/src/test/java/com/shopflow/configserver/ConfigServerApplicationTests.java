package com.shopflow.configserver;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

/** Runs the server against files on the test classpath instead of the real Git repository. */
@SpringBootTest(properties = { "spring.profiles.active=native",
		"spring.cloud.config.server.native.search-locations=classpath:/test-config" })
@AutoConfigureMockMvc
class ConfigServerApplicationTests {

	@Autowired
	private MockMvc mvc;

	@Test
	void servesSharedAndEnvironmentSettingsForAnApplication() throws Exception {
		mvc.perform(get("/backend/qa"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("backend"))
			.andExpect(jsonPath("$.propertySources[?(@.source['app.environment'] == 'qa')]").exists())
			.andExpect(jsonPath("$.propertySources[?(@.source['app.banner'] == 'shared banner')]").exists());
	}

}