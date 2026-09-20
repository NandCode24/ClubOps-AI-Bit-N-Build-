import { createNeonAuth } from "@neondatabase/auth/next/server";

if (!process.env.NEON_AUTH_BASE_URL) {
  console.warn("NEON_AUTH_BASE_URL is not set. Neon Auth server operations may fail.");
}

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL || "",
  cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET || "temporary_fallback_secret_32chars_long!!" },
});
