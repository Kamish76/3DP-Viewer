import { createNeonAuth } from "@neondatabase/auth/next/server";

export const auth = createNeonAuth({
  baseUrl:
    process.env.NEON_AUTH_BASE_URL ||
    "https://ep-dawn-sun-bdlgjo1g.neonauth.c-8.us-east-2.aws.neon.tech/neondb/auth",
  cookies: {
    secret:
      process.env.NEON_AUTH_COOKIE_SECRET ||
      process.env.SESSION_SECRET ||
      "stl-viewer-fallback-session-secret-key-min-32-chars-long",
  },
});
