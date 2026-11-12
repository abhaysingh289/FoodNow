import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config, { dev }) {
    if (dev) {
      // The sqlite files and Playwright's output change constantly while the app runs. Letting the
      // watcher see them makes `next dev` rebuild mid-request (manifest reads then fail with a JSON
      // SyntaxError), which flaked the e2e webhook round-trip.
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**", "**/prisma/*.db*", "**/test-results/**"],
      };
    }
    return config;
  },
};

export default nextConfig;
