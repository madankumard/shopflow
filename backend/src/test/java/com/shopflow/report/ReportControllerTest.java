package com.shopflow.report;

import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import com.shopflow.security.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** Unit tests: the web layer and its access rule, with the figures mocked. */
@WebMvcTest(ReportController.class)
@Import(SecurityConfig.class)
class ReportControllerTest {

	@Autowired
	private MockMvc mvc;

	@MockitoBean
	private ReportService reports;

	@MockitoBean
	private JwtDecoder jwtDecoder;

	@Test
	void adminGetsTheReport() throws Exception {
		given(reports.build()).willReturn(new ReportResponse(3, new BigDecimal("264.47"), 1,
				List.of(new ReportResponse.Day(LocalDate.parse("2026-11-13"), 3, new BigDecimal("264.47"))),
				List.of(new ReportResponse.ProductSales(1L, "Keyboard", 3, new BigDecimal("239.97"))), 10,
				List.of(new ReportResponse.LowStock(3L, "MN-001", "Monitor", 4))));

		mvc.perform(get("/api/reports").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_admin"))))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.orders").value(3))
			.andExpect(jsonPath("$.revenue").value(264.47))
			.andExpect(jsonPath("$.cancelledOrders").value(1))
			.andExpect(jsonPath("$.daily[0].date").value("2026-11-13"))
			.andExpect(jsonPath("$.topProducts[0].unitsSold").value(3))
			.andExpect(jsonPath("$.lowStockThreshold").value(10))
			.andExpect(jsonPath("$.lowStock[0].sku").value("MN-001"));
	}

	@Test
	void theReportNeedsALogin() throws Exception {
		mvc.perform(get("/api/reports")).andExpect(status().isUnauthorized());

		verifyNoInteractions(reports);
	}

	@ParameterizedTest
	@ValueSource(strings = { "customer", "warehouse" })
	void onlyAdminsGetTheReport(String role) throws Exception {
		mvc.perform(get("/api/reports").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_" + role))))
			.andExpect(status().isForbidden());

		verifyNoInteractions(reports);
	}

}
