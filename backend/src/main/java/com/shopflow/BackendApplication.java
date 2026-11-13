package com.shopflow;

import java.time.Clock;
import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class BackendApplication {

	public static void main(String[] args) {
		// Run in UTC everywhere, whatever the host machine's timezone is.
		TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
		SpringApplication.run(BackendApplication.class, args);
	}

	/** The one source of "now", so code that records times can be tested with a fixed clock. */
	@Bean
	Clock clock() {
		return Clock.systemUTC();
	}

}
