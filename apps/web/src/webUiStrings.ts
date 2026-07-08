/**
 * Canonical list of translatable UI strings for the JanVaani web console.
 * Sent to POST /api/web/ui-translations. English text is both the source
 * and the lookup key (default-language-as-key i18n).
 */
export const WEB_UI_STRINGS: string[] = [
  // Navigation
  "Overview", "Demand Signals", "AI Assistant (RAG)", "New", "Recommendations",
  "Projects", "Reports", "Data Explorer", "Knowledge Base", "Map View", "Compare", "Settings",
  "Core workflow", "JanVaani AI", "Constituency Intelligence Platform",
  "Expand navigation", "Collapse navigation", "Open JanVaani",

  // Topbar / shell
  "Tour", "Demo data on", "Disable demo data", "Load local demo data", "Refresh data", "Logout",
  "Live", "Disconnected", "Menu",

  // Control strip
  "My area", "My MP", "All India", "Search school, road, water, ward", "Apply",

  // Connection banner
  "API connection required",

  // Login
  "People's Priorities. Smart Governance.",
  "AI-Powered Intelligence for People-First Governance",
  "Turning citizen voices, public data, and AI insights into better decisions and stronger communities.",
  "Understand People's Priorities", "Collect and analyze multilingual citizen feedback from multiple channels.",
  "Data-Driven Decisions", "Leverage AI and real-time data to identify what matters most.",
  "Plan. Act. Impact.", "Prioritize projects, allocate resources, and track real impact on the ground.",
  "Transparent & Accountable", "Evidence-based insights with full transparency and citizen trust.",
  "Welcome Back", "Sign in to continue to JanVaani AI",
  "Email or Mobile Number", "Enter your email or mobile number",
  "Password", "Enter your password", "Show password", "Hide password",
  "Remember me", "Forgot Password?", "Sign In",
  "or continue with", "MP SSO", "Google", "Microsoft", "Apple",
  "Don't have an account?", "Contact Administrator",
  "Secure & Encrypted", "Data Privacy Compliant", "Government Grade Security",

  // Health gauge
  "Aggregate Health", "Healthy", "Moderate", "Needs attention",
  "AI confidence", "citizen signals", "ward", "wards",

  // Overview page
  "JanVaani AI Executive Overview", "Constituency intelligence command center",
  "A 360 degree view of citizen priorities, AI-ranked risks, development progress, and live alerts for Members of Parliament.",
  "Open AI recommendations", "Review projects", "View GIS map",
  "Citizen Priorities", "processed demand signals",
  "Development Progress", "delayed works need attention",
  "Active Wards", "languages normalized",
  "AI Risk", "bot and duplicate demand monitor",
  "Top Citizen Priorities", "AI-ranked demand",
  "AI Insights", "real-time constituency signals", "Ask JanVaani AI",
  "Real-Time Alerts", "requires action",
  "Demand Hotspots", "affected regions",
  "Budget and Impact", "expected beneficiaries",
  "District Snapshot", "health vs demand",

  // Recommendations page
  "AI Recommendations", "Prioritized development investments",
  "Budget", "Beneficiaries", "Top Confidence", "High Priority",
  "AI-Ranked Recommendations", "projects scored",
  "Affected Regions Map", "priority hotspots", "Tap a marker to view reasoning",
  "AI Reasoning", "High", "Medium", "Low",
  "No recommendations match this filter.",
  "Cost-Benefit Analysis", "beneficiaries per budget unit", "impact index",
  "District Comparison", "average recommendation score",
  "Budget Allocation Suggestions", "AI-balanced portfolio",
  "Fund top 3 high-priority works first",
  "Reserve 18% contingency for delayed tenders",
  "Shift low-confidence proposals to evidence review",
  "Bundle nearby road and drainage works",
  "Project Ranking Table", "decision-ready queue",
  "Project", "Category", "Score", "Priority",
  "Jump to", "Analytics", "Full Table",

  // Projects page
  "MP Project Command Center", "Development projects management",
  "Track constituency works from proposal to completion with risk, expenditure, milestones, evidence, and citizen impact in one place.",
  "Ongoing", "Completed", "Delayed", "Proposed",
  "Search projects, departments, contractors, wards...",
  "Risk", "complete",
  "Kanban Board", "Linear/Jira delivery flow",
  "Timeline", "Gantt view",
  "District Project Map", "interactive portfolio geography",
  "Expenditure Tracking", "Milestone Tracker",
  "Delay Alerts", "AI risk monitor",
  "Documents and Media", "evidence room",
  "AI Recommendations", "execution improvement",
  "Project actions ready.",

  // Reports page
  "Official AI Reports", "Generate constituency briefings",
  "Create polished government-ready reports with AI summaries, charts, maps, tables, citations, and branded export packages.",
  "Export PDF", "Export PowerPoint", "Export Word", "Export Excel",
  "Report Preview", "official presentation layout",
  "AI Executive Summary", "editable draft",
  "Scheduled Reports", "automated delivery",
  "Share with MP office and district team",
  "Demand Chart", "citizen priorities",
  "Map Snapshot", "Citations", "source-backed claims",
  "Report Data Table", "ready for Excel export",
  "Sharing and Branding", "official government presentation",
  "Share secure link", "Email MP office", "Prepare cabinet note", "Apply JanVaani AI branding",

  // Copilot page
  "Grounded AI Assistant", "Ask anything. Answers are backed by real data and sources.",
  "History", "New Query", "Query History",
  "Compare roads vs healthcare", "Which villages lack PHCs?", "Show delayed projects", "Summarize citizen feedback",
  "Ask about any priority, project, source, or budget path…",
  "Why is River Market high priority?", "Which scheme can fund this?",
  "What changed since yesterday?", "Generate a district-officer briefing.",
  "Submitted Issues", "Online", "All", "Filters", "Ask AI",
  "Expected Impact", "Citizens benefited", "Confidence Score", "Based on", "source groups",
  "Export Answer", "Export PDF", "Export Word", "Export PPT", "Share Answer",
  "Key Evidence", "No answer yet", "Run a query to see retrieved sources.",
  "Evidence Map", "Related Projects", "Timeline of Events", "Grounded By", "Sources",
  "How AI Reached This Answer", "AI Recommendation",
  "PDF export opened — use the print dialog to save as PDF.",
  "Answer shared.", "Share cancelled.", "Answer copied to clipboard.",
  "Could not copy answer.", "Sharing is not supported in this browser.",
  "Word document downloaded.", "PowerPoint (.pptx) downloaded.",
  "Could not generate the presentation.",

  // Knowledge base
  "Enterprise Knowledge Base", "Constituency intelligence library",
  "Indexed Docs", "Vector Chunks", "Vector DB", "Index Freshness",
  "Search PDFs, policies, complaints, circulars, meeting minutes...",
  "Upload and Ingest", "drag-and-drop intake",
  "Drop PDFs, scans, images, CSVs, minutes, or circulars",
  "OCR, chunking, embedding, duplicate detection, and citation extraction run automatically.",
  "Choose files", "Indexed Sources", "SharePoint-style repository",
  "Document Preview", "Version History", "AI Summary and Citations",
  "grounded answer context", "Vector Database", "retrieval health",
  "Knowledge Graph", "evidence relationships",

  // Data explorer
  "Data Explorer", "Constituency data workspace",
  "Inspect live citizen signals, project rankings, public datasets, map layers, and indexed evidence before they feed AI dashboards.",
  "Datasets", "Rows", "Quality", "Refresh",
  "Citizen Submissions", "Active raw intake", "Noise Gate", "score <25 discarded",
  "Ranked Projects", "Demand Signals", "Public Datasets",
  "Maps Layers", "RAG Evidence",
  "Awaaz Intake Audit Trail", "Run on-demand AI pipeline", "Refresh intake log",
  "Latest citizen submissions", "Selected AI inference",
  "Receipt", "AI tag", "Language", "Region placed", "MP route",
  "pending", "format only", "verified",
  "Citizen score", "Quality score", "Civic issue", "Needs review",
  "Voice, image, text test kit", "Query Builder", "reviewed source query",
  "Run query", "Schema Browser", "Data Quality", "pipeline checks",
  "Deduplication complete", "PII safeguards active",
  "Geo coordinates validated", "Evidence citations linked",
  "Live Data Preview", "project ranking dataset",

  // Map / GIS
  "All-India issue atlas", "Geospatial demand hotspots", "Premium GIS control room",
  "ward-level signals", "boundary features", "AI clusters",
  "Layers", "Analysis", "Route analysis", "Buffer 2 km", "Flood overlap",
  "Boundary clip", "All issue types", "High confidence", "All confidence levels",
  "Needs verification", "AI hotspot detection", "Cluster markers", "Demand heatmap",
  "Map hotspot details", "Boundary layers", "Hotspot clusters", "Boundary level",
  "state", "district", "constituency",
  "Map tiles © OpenStreetMap contributors",

  // Compare
  "Synchronized Analytics", "Constituency Comparison Dashboard",
  "Compare states, districts, or constituencies across citizen demand, infrastructure, budget, demographics, projects, and AI priority.",
  "Compare Level", "States", "Districts", "Constituencies",
  "Radar Comparison", "normalized strengths", "Budget Analysis", "utilization vs demand",
  "Trend Lines", "synchronized 6-month view", "Infrastructure Heatmap", "category intensity",
  "Demographic Comparison", "Project Completion Rates", "AI-Generated Insights",
  "Select at least two regions to generate comparative insights.",

  // Settings
  "Enterprise Administration", "AI Governance Settings",
  "Manage JanVaani AI workspace identity, model access, connectors, security controls, and operational health.",
  "Profile", "Constituency Settings", "AI Model Selection", "API Keys & Integrations",
  "Data Sources", "Notification Preferences", "Security", "Access Control",
  "Language & Theme", "Backup Settings", "Billing", "Audit Logs",
  "Light", "Dark", "System", "Hourly", "Daily", "Weekly",
  "90 days", "Enterprise pilot", "Governed by API quotas",

  // Pulse page
  "Top 5 Citizen Problems", "Problem Heatmap", "complaints density",
  "District Ranking", "Trending This Week", "Complaint Index",
  "Problem by Area Type", "Total", "Rural", "Urban", "Peri-Urban",
  "Clear JanVaani AI answer", "Send",
  "National pulse fills in as citizen submissions are processed.",

  // Priority desk
  "Constituency signal summary", "Submissions analyzed", "Ranked works",
  "Awaiting decision", "evidence attached, ready to act", "Decisions made",
  "Ranked priority queue", "Filter works by decision stage",
  "No works in this stage for the selected area yet.",
  "Decision brief", "Decision actions",
  "Citizen demand", "Ground need", "Urgency", "Equity", "Reward quality", "Evidence",
  "Recent contributors", "Safeguards", "Citizen rating", "Rate this priority",

  // Page labels
  "Executive home", "All states and UTs", "Demand hotspots", "AI web intelligence",
  "Source data", "Grounded answers", "Document intelligence", "AI prioritization",
  "Execution portfolio", "Official reporting", "Comparative intelligence", "Administration",
  "Ranked development priorities", "Top 5 problems across India",
  "Where demand is concentrated", "What the web says citizens need",
  "Explore source data", "Ask why a work ranks high", "Knowledge base and indexing",
  "AI-ranked development recommendations", "Development projects management",
  "AI-powered constituency reports", "Compare constituencies and districts",
  "Enterprise AI governance settings",

  // Tour
  "Back", "Finish", "Next", "Solution tour",
  "Start with constituency health", "Citizen submission starts the flow",
  "Demand Signals explains what citizens need", "RAG answers are grounded",
  "Recommendations become execution priorities", "Projects track delivery",
  "Map shows where action is needed", "Reports package the decision",
  "Admin controls keep it governed",

  // Status / misc
  "In review", "awaiting MP decision", "Shortlisted", "queued for approval",
  "Approved", "cleared for execution",
  "Session expired. Please log in again.",
];
