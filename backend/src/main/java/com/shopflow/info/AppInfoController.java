package com.shopflow.info;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/info")
public class AppInfoController {

	private final AppInfoResponse info;

	public AppInfoController(@Value("${app.environment}") String environment,
			@Value("${app.version}") String version) {
		this.info = new AppInfoResponse(environment, version);
	}

	@GetMapping
	public AppInfoResponse get() {
		return info;
	}

}
