package com.shopflow.info;

/**
 * Which environment this instance serves, which build it is running, and an optional
 * announcement for that environment (empty when there is none).
 */
public record AppInfoResponse(String environment, String version, String banner) {
}
