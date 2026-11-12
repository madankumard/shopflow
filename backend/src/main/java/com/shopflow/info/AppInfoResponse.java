package com.shopflow.info;

/** Which environment this instance serves and which build it is running. */
public record AppInfoResponse(String environment, String version) {
}
