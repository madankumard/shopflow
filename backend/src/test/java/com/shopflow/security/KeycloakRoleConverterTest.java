package com.shopflow.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

class KeycloakRoleConverterTest {

	private final KeycloakRoleConverter converter = new KeycloakRoleConverter();

	@Test
	void mapsRealmRolesToRoleAuthorities() {
		Jwt jwt = token().claim("realm_access", Map.of("roles", List.of("admin", "warehouse"))).build();

		assertThat(converter.convert(jwt)).extracting(GrantedAuthority::getAuthority)
			.containsExactly("ROLE_admin", "ROLE_warehouse");
	}

	@Test
	void givesNoAuthoritiesWhenTheTokenHasNoRoles() {
		assertThat(converter.convert(token().build())).isEmpty();
		assertThat(converter.convert(token().claim("realm_access", Map.of()).build())).isEmpty();
	}

	private static Jwt.Builder token() {
		return Jwt.withTokenValue("token").header("alg", "none").subject("user-1");
	}

}
