import { expect, request, test } from "@playwright/test";

const apiUrl = "http://127.0.0.1:28080";

async function newApiContext() {
  const password = process.env.TEST_APP_ACCESS_PASSWORD;
  const loginContext = await request.newContext({ baseURL: apiUrl });
  if (password) {
    const login = await loginContext.post("/api/auth/login", { data: { password } });
    if (login.ok()) {
      const payload = await login.json() as { token?: string };
      await loginContext.dispose();
      return request.newContext({
        baseURL: apiUrl,
        extraHTTPHeaders: payload.token ? { Authorization: `Bearer ${payload.token}` } : undefined
      });
    }
  }
  await loginContext.dispose();
  return request.newContext({ baseURL: apiUrl });
}

test.describe("API functional flow", () => {
  test("health, dashboard, submission queue, and batch status work", async () => {
    const api = await newApiContext();

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

    const citizenSession = await api.post("/api/citizen/session", {
      data: { aadhaarNumber: "234567890123" }
    });
    await expect(citizenSession).toBeOK();
    const citizenSessionPayload = await citizenSession.json();
    expect(citizenSessionPayload.citizen.aadhaarMasked).toBe("xxxx-xxxx-0123");
    expect(citizenSessionPayload.citizen.aadhaarVerified).toBe(false);
    const citizenApi = await request.newContext({
      baseURL: apiUrl,
      extraHTTPHeaders: { Authorization: `Bearer ${citizenSessionPayload.token}` }
    });
    const citizenPriorities = await citizenApi.get("/api/priorities?scope=global");
    expect([200, 403]).toContain(citizenPriorities.status());
    if (citizenPriorities.status() === 403) {
      expect((await citizenPriorities.json()).error).toContain("Citizen token is limited");
    }
    await citizenApi.dispose();

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
        aadhaarNumber: "234567890123",
        text: "Functional test: school road floods and street lights are broken."
      }
    });
    expect(submission.status()).toBe(202);
    const receipt = await submission.json();
    expect(receipt.status).toBe("pending_batch");
    expect(receipt.rawIntakeId).toBeTruthy();
    expect(receipt.aadhaarMasked).toBe("xxxx-xxxx-0123");

    const rewardLookup = await api.post("/api/citizen/rewards/lookup", {
      data: { aadhaarNumber: "234567890123" }
    });
    await expect(rewardLookup).toBeOK();
    const rewardPayload = await rewardLookup.json();
    expect(rewardPayload.aadhaarMasked).toBe("xxxx-xxxx-0123");
    expect(rewardPayload.totalRewardPoints).toBeGreaterThanOrEqual(0);
    expect(rewardPayload.pendingSubmissionCount + rewardPayload.processedSubmissionCount).toBeGreaterThanOrEqual(1);
    expect(rewardPayload.currentMilestone.title).toBeTruthy();

    const batchStatus = await api.get("/api/batch/status");
    await expect(batchStatus).toBeOK();
    expect((await batchStatus.json()).mode).toBe("batch");

    const aiOps = await api.get("/api/ai-ops");
    await expect(aiOps).toBeOK();
    const aiOpsPayload = await aiOps.json();
    expect(["Vertex AI Gemini", "OpenAI-compatible Gemini"]).toContain(aiOpsPayload.provider);
    expect(["unconfigured", "fallback", "openai-compatible"]).toContain(aiOpsPayload.mode);

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
    expect(copilotMeta.rag.mode).toBe("pgvector-hybrid");

    const ragStatus = await api.get("/api/copilot/rag-status");
    await expect(ragStatus).toBeOK();
    const ragPayload = await ragStatus.json();
    expect(["not-configured", "pgvector-hybrid"]).toContain(ragPayload.mode);

    const copilotAnswer = await api.post("/api/copilot/query", {
      data: {
        role: "mp",
        language: "English",
        question: "bihar stats"
      }
    });
    await expect(copilotAnswer).toBeOK();
    const copilotPayload = await copilotAnswer.json();
    expect(copilotPayload.answer).not.toContain("Kalindi Nagar");
    expect(copilotPayload.answer).not.toContain(globalPriorities.projects[0].title);
    expect(copilotPayload.guardrails.length).toBeGreaterThan(0);
    expect(["not-configured", "pgvector-hybrid", "pgvector-hybrid-no-match", "pgvector-hybrid-crag", "pgvector-hybrid-crag-ambiguous", "pgvector-hybrid-crag-no-match"]).toContain(copilotPayload.retrieval.mode);
    expect(JSON.stringify(copilotPayload)).not.toContain("username");

    const onlineAnswer = await api.post("/api/copilot/query", {
      data: {
        role: "mp",
        language: "English",
        mode: "online",
        question: "Why are road complaints increasing in Ludhiana South?"
      }
    });
    await expect(onlineAnswer).toBeOK();
    const onlinePayload = await onlineAnswer.json();
    expect(onlinePayload.mode).toBe("online");
    expect(onlinePayload.answer.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(100);
    expect(onlinePayload.answer).not.toContain("Online mode summary");
    for (const item of onlinePayload.citations as Array<{ url?: string }>) {
      expect(item.url).toMatch(/^https?:\/\//);
    }

    const chipQuestions = [
      "Compare roads vs healthcare",
      "Which villages lack PHCs?",
      "Show delayed projects",
      "Summarize citizen feedback"
    ];
    const chipAnswers = await Promise.all(chipQuestions.map(async (question) => {
      const answer = await api.post("/api/copilot/query", {
        data: { role: "mp", language: "English", mode: "submitted", question }
      });
      await expect(answer).toBeOK();
      return (await answer.json()) as { answer: string };
    }));
    expect(new Set(chipAnswers.map((item) => item.answer)).size).toBe(chipQuestions.length);
    expect(chipAnswers[0].answer).toContain("Roads vs healthcare");
    expect(chipAnswers[1].answer).not.toContain("Top current priorities");
    expect(chipAnswers[2].answer).not.toContain("Top current priorities");
    expect(chipAnswers[3].answer).toContain("Citizen feedback summary");

    const shortGreeting = await api.post("/api/copilot/query", {
      data: { role: "mp", language: "English", question: "hi" }
    });
    await expect(shortGreeting).toBeOK();
    const greetingPayload = await shortGreeting.json();
    expect(greetingPayload.intent).toBe("greeting");
    expect(greetingPayload.answer).toContain("Ask me about constituency priorities");

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
    const api = await newApiContext();
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

  test("dashboard users are permissioned and locked to their configured constituency", async () => {
    const admin = await newApiContext();
    const username = "mp.lucknow.scoped";
    const password = "ScopedPass123!";
    const create = await admin.post("/api/admin/users", {
      data: {
        username,
        password,
        displayName: "Lucknow MP Office",
        role: "mp",
        state: "Uttar Pradesh",
        district: "Lucknow",
        constituencyId: "mp-up-lucknow",
        permissions: ["dashboard:view", "issues:view"]
      }
    });
    expect(create.status()).toBe(201);
    const created = await create.json();
    expect(created.user).toMatchObject({
      username,
      role: "mp",
      state: "Uttar Pradesh",
      district: "Lucknow",
      constituencyId: "mp-up-lucknow",
      constituencyName: "MP Lucknow"
    });
    const duplicate = await admin.post("/api/admin/users", {
      data: {
        username,
        password: "ReplacementPass123!",
        displayName: "Duplicate Account",
        role: "mp",
        state: "Uttar Pradesh",
        district: "Lucknow",
        constituencyId: "mp-up-lucknow",
        permissions: ["dashboard:view", "issues:view"]
      }
    });
    expect(duplicate.status()).toBe(409);
    await admin.dispose();

    const loginContext = await request.newContext({ baseURL: apiUrl });
    const login = await loginContext.post("/api/auth/login", { data: { username, password } });
    await expect(login).toBeOK();
    const loginPayload = await login.json();
    expect(loginPayload.user.permissions).toEqual(["dashboard:view", "issues:view"]);
    await loginContext.dispose();

    const scoped = await request.newContext({
      baseURL: apiUrl,
      extraHTTPHeaders: { Authorization: `Bearer ${loginPayload.token}` }
    });
    const session = await scoped.get("/api/session");
    await expect(session).toBeOK();
    expect(await session.json()).toMatchObject({
      defaultScope: "mp",
      allowedScopes: ["mp"],
      restricted: true,
      area: { state: "Uttar Pradesh", district: "Lucknow", constituencyId: "mp-up-lucknow" }
    });

    const context = await scoped.get("/api/context");
    await expect(context).toBeOK();
    const scopedContext = await context.json();
    expect(scopedContext.states).toEqual(["Uttar Pradesh"]);
    expect(scopedContext.districts).toEqual(["Lucknow"]);
    expect(scopedContext.mps.map((mp: { id: string }) => mp.id)).toEqual(["mp-up-lucknow"]);

    const tamperedGlobal = await scoped.get("/api/priorities?scope=global&state=Delhi&district=Central%20Delhi");
    await expect(tamperedGlobal).toBeOK();
    const scopedDashboard = await tamperedGlobal.json();
    expect(scopedDashboard.projects.length).toBeGreaterThan(0);
    expect(scopedDashboard.projects.every((project: { mpId: string; state: string; district: string }) =>
      project.mpId === "mp-up-lucknow" && project.state === "Uttar Pradesh" && project.district === "Lucknow"
    )).toBe(true);

    const deniedUpdate = await scoped.patch(`/api/projects/${scopedDashboard.projects[0].id}/status`, {
      data: { status: "approved" }
    });
    expect(deniedUpdate.status()).toBe(403);
    expect((await deniedUpdate.json()).error).toContain("Project update permission");

    const deniedUserCreate = await scoped.post("/api/admin/users", {
      data: {
        username: "outside.scope",
        password: "OutsidePass123!",
        displayName: "Outside Scope",
        role: "mp",
        state: "Delhi",
        district: "Central Delhi",
        constituencyId: "mp-delhi-central",
        permissions: ["dashboard:view"]
      }
    });
    expect(deniedUserCreate.status()).toBe(403);
    await scoped.dispose();
  });

  test("district managers can drill down safely without escalating roles or permissions", async () => {
    const admin = await newApiContext();
    const username = "district.lucknow.manager";
    const password = "DistrictPass123!";
    const create = await admin.post("/api/admin/users", {
      data: {
        username,
        password,
        displayName: "Lucknow District Manager",
        role: "district_admin",
        state: "Uttar Pradesh",
        district: "Lucknow",
        permissions: ["dashboard:view", "issues:view", "users:manage"]
      }
    });
    expect(create.status()).toBe(201);
    await admin.dispose();

    const loginContext = await request.newContext({ baseURL: apiUrl });
    const login = await loginContext.post("/api/auth/login", { data: { username, password } });
    await expect(login).toBeOK();
    const loginPayload = await login.json();
    await loginContext.dispose();

    const manager = await request.newContext({
      baseURL: apiUrl,
      extraHTTPHeaders: { Authorization: `Bearer ${loginPayload.token}` }
    });
    const wardView = await manager.get("/api/priorities?scope=local&state=Delhi&district=Central%20Delhi&ward=Aminabad%20Basti");
    await expect(wardView).toBeOK();
    const wardPayload = await wardView.json();
    expect(wardPayload.projects.length).toBeGreaterThan(0);
    expect(wardPayload.projects.every((project: { state: string; district: string; ward: string }) =>
      project.state === "Uttar Pradesh" && project.district === "Lucknow" && project.ward === "Aminabad Basti"
    )).toBe(true);

    const outsideWard = await manager.get("/api/priorities?scope=local&ward=Kalindi%20Nagar");
    await expect(outsideWard).toBeOK();
    expect((await outsideWard.json()).projects).toHaveLength(0);

    const permissionEscalation = await manager.post("/api/admin/users", {
      data: {
        username: "district.escalated.permission",
        password: "EscalatedPass123!",
        displayName: "Escalated Permission",
        role: "district_admin",
        state: "Uttar Pradesh",
        district: "Lucknow",
        permissions: ["dashboard:view", "issues:view", "projects:update"]
      }
    });
    expect(permissionEscalation.status()).toBe(403);
    expect((await permissionEscalation.json()).error).toContain("permissions you do not possess");

    const roleEscalation = await manager.post("/api/admin/users", {
      data: {
        username: "district.escalated.role",
        password: "EscalatedPass123!",
        displayName: "Escalated Role",
        role: "state_admin",
        state: "Uttar Pradesh",
        district: "Lucknow",
        permissions: ["dashboard:view", "issues:view", "users:manage"]
      }
    });
    expect(roleEscalation.status()).toBe(403);
    expect((await roleEscalation.json()).error).toContain("role above your own");
    await manager.dispose();
  });

  test("shared-password login does not accept an unknown username", async () => {
    const sharedPassword = process.env.TEST_APP_ACCESS_PASSWORD;
    test.skip(!sharedPassword, "Shared-password mode is not enabled for this run");
    const api = await request.newContext({ baseURL: apiUrl });
    const response = await api.post("/api/auth/login", {
      data: { username: "unknown.dashboard.user", password: sharedPassword }
    });
    expect(response.status()).toBe(401);
    await api.dispose();
  });
});
