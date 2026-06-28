import { defineConfig, devices } from "@playwright/test";

const apiUrl = "http://127.0.0.1:18080";
const webUrl = "http://127.0.0.1:15173";
const citizenUrl = "http://127.0.0.1:15174";

export default defineConfig({
  testDir: "tests/functional",
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "api",
      testMatch: /api\.spec\.ts/
    },
    {
      name: "web",
      testMatch: /web\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: webUrl }
    },
    {
      name: "citizen",
      testMatch: /citizen\.spec\.ts/,
      use: { ...devices["Pixel 7"], baseURL: citizenUrl }
    }
  ],
  webServer: [
    {
      command: "PORT=18080 VERTEX_AI_DISABLED=true npm run dev -w services/api",
      url: `${apiUrl}/healthz`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000
    },
    {
      command: `VITE_API_BASE_URL=${apiUrl} npm run dev -w apps/web -- --port 15173 --host 127.0.0.1`,
      url: webUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000
    },
    {
      command: `VITE_API_BASE_URL=${apiUrl} npm run dev -w apps/citizen -- --port 15174 --host 127.0.0.1`,
      url: citizenUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000
    }
  ]
});
