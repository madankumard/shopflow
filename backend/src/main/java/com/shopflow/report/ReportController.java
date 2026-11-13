package com.shopflow.report;

import com.shopflow.security.SecurityConfig;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Admins only; the rule is in {@link SecurityConfig}. */
@RestController
@RequestMapping("/api/reports")
public class ReportController {

	private final ReportService reports;

	public ReportController(ReportService reports) {
		this.reports = reports;
	}

	@GetMapping
	public ReportResponse get() {
		return reports.build();
	}

}
