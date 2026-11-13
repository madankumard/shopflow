package com.shopflow.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Who may call what. Users log in at Keycloak; each request then carries a signed token,
 * which is checked here. The backend keeps no session and never sees a password.
 */
@Configuration
public class SecurityConfig {

	/** Role names as defined in the Keycloak realm (infra/keycloak/shopflow-realm.json). */
	public static final String CUSTOMER = "customer";

	public static final String WAREHOUSE = "warehouse";

	public static final String ADMIN = "admin";

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
		http
			// No cookies or sessions are used, so there is nothing for CSRF to exploit.
			.csrf(csrf -> csrf.disable())
			.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.authorizeHttpRequests(requests -> requests
				// Open to everyone: health probes, build info and browsing the catalogue.
				.requestMatchers("/actuator/health/**", "/actuator/info").permitAll()
				.requestMatchers(HttpMethod.GET, "/api/info", "/api/products", "/api/products/*").permitAll()
				// Changing the catalogue is for admins.
				.requestMatchers(HttpMethod.POST, "/api/products").hasRole(ADMIN)
				// Orders: customers place and see their own; the warehouse works through all of
				// them; only an admin may cancel. A single order is open to any logged-in user
				// here, and OrderService then hides other customers' orders.
				.requestMatchers(HttpMethod.POST, "/api/orders").hasRole(CUSTOMER)
				.requestMatchers(HttpMethod.GET, "/api/orders/mine").hasRole(CUSTOMER)
				.requestMatchers(HttpMethod.GET, "/api/orders").hasAnyRole(WAREHOUSE, ADMIN)
				.requestMatchers(HttpMethod.GET, "/api/orders/*").authenticated()
				.requestMatchers(HttpMethod.POST, "/api/orders/*/advance").hasAnyRole(WAREHOUSE, ADMIN)
				.requestMatchers(HttpMethod.POST, "/api/orders/*/cancel").hasRole(ADMIN)
				// Anything added later is closed until a rule here opens it.
				.anyRequest().authenticated())
			.oauth2ResourceServer(server -> server
				.jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter())));
		return http.build();
	}

	private JwtAuthenticationConverter jwtAuthenticationConverter() {
		JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
		converter.setJwtGrantedAuthoritiesConverter(new KeycloakRoleConverter());
		// Use the login name, not Keycloak's internal user id, as the user's name.
		converter.setPrincipalClaimName("preferred_username");
		return converter;
	}

}
