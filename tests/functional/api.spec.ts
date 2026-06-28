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
    const globalPriorities = await priorities.json();
    expect(globalPriorities.projects.length).toBeGreaterThanOrEqual(8);
    expect(globalPriorities.hotspots.length).toBeGreaterThanOrEqual(6);
    expect(globalPriorities.projects.map((project: { category: string }) => project.category)).toContain("Sanitation");
    expect(globalPriorities.projects.map((project: { category: string }) => project.category)).toContain("Digital Access");

    const clientConfig = await api.get("/api/client-config");
    await expect(clientConfig).toBeOK();
    const configPayload = await clientConfig.json();
    expect(configPayload.maps).toHaveProperty("enabled");
    expect(configPayload.maps).toHaveProperty("source");

    const context = await api.get("/api/context");
    await expect(context).toBeOK();
    const contextPayload = await context.json();
    expect(contextPayload.states).toContain("Tamil Nadu");
    expect(contextPayload.districtsByState["Uttar Pradesh"]).toContain("Lucknow");
    expect(contextPayload.wardsByDistrict["Uttar Pradesh::Lucknow"]).toContain("Aminabad Basti");
    expect(contextPayload.mps.map((mp: { id: string }) => mp.id)).toContain("mp-up-lucknow");

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

    const aiOps = await api.get("/api/ai-ops");
    await expect(aiOps).toBeOK();
    const aiOpsPayload = await aiOps.json();
    expect(["Vertex AI Gemini", "OpenAI-compatible Gemini"]).toContain(aiOpsPayload.provider);
    expect(["fallback", "openai-compatible"]).toContain(aiOpsPayload.mode);

    const publicProjects = await api.get("/api/public/projects?scope=global&limit=5");
    await expect(publicProjects).toBeOK();
    const publicPayload = await publicProjects.json();
    expect(publicPayload.items.length).toBe(5);
    expect(publicPayload.items[0].contributorsHidden).toBe(true);
    expect(publicPayload.items[0].ratings).toBeGreaterThan(0);
    expect(JSON.stringify(publicPayload)).not.toContain("username");

    const detail = await api.get(`/api/public/projects/${publicPayload.items[0].id}`);
    await expect(detail).toBeOK();
    const detailPayload = await detail.json();
    expect(detailPayload.project.scoreBreakdown).toBeTruthy();
    expect(detailPayload.project.safeguards.length).toBeGreaterThan(0);
    expect(detailPayload.project.sourceSnapshotIds.length).toBeGreaterThan(0);

    const delhiMpProject = globalPriorities.projects.find((project: { mpId: string }) => project.mpId === "mp-delhi-central");
    expect(delhiMpProject).toBeTruthy();
    const statusUpdate = await api.patch(`/api/projects/${delhiMpProject.id}/status`, {
      data: { actorId: "mp-user-delhi-central", status: "approved" }
    });
    await expect(statusUpdate).toBeOK();
    expect((await statusUpdate.json()).project.status).toBe("approved");

    const ratingUpdate = await api.post(`/api/projects/${delhiMpProject.id}/ratings`, {
      data: { rating: 5 }
    });
    expect(ratingUpdate.status()).toBe(201);
    expect((await ratingUpdate.json()).message).toContain("Rating recorded");

    const mappingUpdate = await api.post("/api/admin/area-mappings", {
      data: {
        actorId: "state-admin-india",
        ward: "Kalindi Nagar",
        mpId: "mp-delhi-east",
        wardStaffUserIds: []
      }
    });
    await expect(mappingUpdate).toBeOK();
    expect((await mappingUpdate.json()).mapping.mpId).toBe("mp-delhi-east");

    const auditAfterMutation = await api.get("/api/audit");
    await expect(auditAfterMutation).toBeOK();
    const auditPayload = await auditAfterMutation.json();
    expect(auditPayload.events.map((event: { action: string }) => event.action)).toContain("updated_area_mapping");
    expect(auditPayload.events.map((event: { action: string }) => event.action)).toContain("updated_project_status");

    const deniedQueue = await api.get("/api/mp/queue?actorId=mp-user-delhi-central&mpId=mp-up-lucknow");
    expect(deniedQueue.status()).toBe(403);
    const allowedQueue = await api.get("/api/mp/queue?actorId=mp-user-delhi-central&mpId=mp-delhi-central");
    await expect(allowedQueue).toBeOK();
    expect((await allowedQueue.json()).projects.length).toBeGreaterThan(0);

    const dataSources = await api.get("/api/data-sources");
    await expect(dataSources).toBeOK();
    expect((await dataSources.json()).snapshots.length).toBeGreaterThan(0);

    const boundaries = await api.get("/api/maps/boundaries");
    await expect(boundaries).toBeOK();
    const boundaryPayload = await boundaries.json();
    expect(boundaryPayload.sourceStatus).toBe("official_boundary_procurement_required");
    expect(boundaryPayload.levels).toEqual(["state", "district", "constituency", "ward"]);
    expect(boundaryPayload.features.length).toBeGreaterThan(0);
    expect(boundaryPayload.features[0]).toHaveProperty("source");
    expect(boundaryPayload.features[0]).toHaveProperty("version");
    expect(boundaryPayload.features[0]).toHaveProperty("freshness");
    expect(boundaryPayload.features[0].simplification).toHaveProperty("toleranceMeters");
    expect(boundaryPayload.features.map((feature: { level: string }) => feature.level)).toContain("ward");

    const clusters = await api.get("/api/maps/clusters?zoom=5");
    await expect(clusters).toBeOK();
    const clusterPayload = await clusters.json();
    expect(clusterPayload.source).toBe("ranked_project_hotspots");
    expect(clusterPayload.clusters.length).toBeGreaterThan(0);
    expect(clusterPayload.clusters[0].projectIds.length).toBeGreaterThan(0);
    expect(clusterPayload.clusters[0].categories.length).toBeGreaterThan(0);

    const intelligenceSources = await api.get("/api/intelligence/sources");
    await expect(intelligenceSources).toBeOK();
    const sourcePayload = await intelligenceSources.json();
    expect(sourcePayload.coverage.totalSources).toBeGreaterThanOrEqual(20);
    expect(sourcePayload.groups.map((group: { category: string }) => group.category)).toContain("Citizen Sources");
    expect(sourcePayload.groups.map((group: { category: string }) => group.category)).toContain("Government Data");
    expect(sourcePayload.groups.map((group: { category: string }) => group.category)).toContain("Maps and Geospatial");

    const dailyIntelligence = await api.get("/api/intelligence/daily");
    await expect(dailyIntelligence).toBeOK();
    const dailyPayload = await dailyIntelligence.json();
    expect(dailyPayload.digest.length).toBeGreaterThan(0);
    expect(dailyPayload.topEmergingIssues.length).toBeGreaterThan(0);
    expect(dailyPayload.indices).toHaveProperty("developmentOpportunityIndex");
    expect(dailyPayload.recommendations.length).toBeGreaterThan(0);

    const copilotCapabilities = await api.get("/api/copilot/capabilities");
    await expect(copilotCapabilities).toBeOK();
    const copilotMeta = await copilotCapabilities.json();
    expect(copilotMeta.agents.map((agent: { id: string }) => agent.id)).toContain("mp-copilot");
    expect(copilotMeta.supportedRoles).toContain("citizen");

    const copilotAnswer = await api.post("/api/copilot/query", {
      data: {
        role: "mp",
        language: "English",
        question: "Why is the highest ranked project urgent?",
        projectId: globalPriorities.projects[0].id
      }
    });
    await expect(copilotAnswer).toBeOK();
    const copilotPayload = await copilotAnswer.json();
    expect(copilotPayload.answer).toContain(globalPriorities.projects[0].title);
    expect(copilotPayload.citations.length).toBeGreaterThan(0);
    expect(copilotPayload.guardrails.length).toBeGreaterThan(0);

    const enterprise = await api.get("/api/enterprise/situation-room");
    await expect(enterprise).toBeOK();
    const enterprisePayload = await enterprise.json();
    expect(enterprisePayload.liveMonitoring.length).toBeGreaterThanOrEqual(8);
    expect(enterprisePayload.incidents.length).toBeGreaterThan(0);
    expect(enterprisePayload.anomalies.length).toBeGreaterThan(0);
    expect(enterprisePayload.healthScore.score).toBeGreaterThan(0);
    expect(enterprisePayload.observability.system.length).toBeGreaterThan(0);

    const externalSignals = await api.get("/api/external-signals?provider=x&q=school%20road%20India");
    await expect(externalSignals).toBeOK();
    expect((await externalSignals.json()).totalAccepted).toBeGreaterThan(0);

    const scenarios = await api.get("/api/simulation/scenarios");
    await expect(scenarios).toBeOK();
    expect((await scenarios.json()).scenarios.length).toBeGreaterThanOrEqual(4);

    const simulation = await api.post("/api/simulation/submit", {
      data: {
        channel: "video",
        state: "Uttar Pradesh",
        district: "Lucknow",
        ward: "Aminabad Basti",
        language: "Hindi",
        urgency: 5,
        rating: 4,
        text: "Video simulation shows drain overflow entering homes.",
        media: "data:video/webm;base64,GkXfo0AgQoaBAUL3gQFC8oEEQvOBCEKCQAR3ZWJtQoeBAkKFgQIYU4BnQI0VSalmQCgq17FAAw9CQE2AQAZ3aWRlbw=="
      }
    });
    expect(simulation.status()).toBe(202);
    expect((await simulation.json()).status).toBe("pending_batch");

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
