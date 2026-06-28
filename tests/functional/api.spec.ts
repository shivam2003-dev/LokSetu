import { expect, request, test } from "@playwright/test";

const apiUrl = "http://127.0.0.1:18080";

test.describe("API functional flow", () => {
  test("health, dashboard, submission queue, and batch status work", async () => {
    const api = await request.newContext({ baseURL: apiUrl });

    const health = await api.get("/healthz");
    await expect(health).toBeOK();
    await expect(await health.json()).toMatchObject({ ok: true, processing: "batch" });

    const priorities = await api.get("/api/priorities?scope=global");
    await expect(priorities).toBeOK();
    expect((await priorities.json()).projects.length).toBeGreaterThan(0);

    const submission = await api.post("/api/submissions", {
      data: {
        channel: "text",
        username: "functional-test",
        privacyMode: true,
        state: "Delhi",
        district: "Central Delhi",
        ward: "Kalindi Nagar",
        urgency: 5,
        rating: 5,
        text: "Functional test: school road floods and street lights are broken."
      }
    });
    expect(submission.status()).toBe(202);
    const receipt = await submission.json();
    expect(receipt.status).toBe("pending_batch");
    expect(receipt.rawIntakeId).toBeTruthy();

    const batchStatus = await api.get("/api/batch/status");
    await expect(batchStatus).toBeOK();
    expect((await batchStatus.json()).mode).toBe("batch");

    await api.dispose();
  });

  test("whatsapp simulator queues multilingual intake", async () => {
    const api = await request.newContext({ baseURL: apiUrl });
    const response = await api.post("/api/whatsapp/simulate", {
      data: {
        from: "919999000111",
        text: "हमारे वार्ड में पानी की पाइप टूट गई है और सड़क पर पानी भर रहा है"
      }
    });
    expect(response.status()).toBe(202);
    const receipt = await response.json();
    expect(receipt.status).toBe("pending_batch");
    await api.dispose();
  });
});
