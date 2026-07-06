import { AreaMapping, CivicDataset, SourceSnapshot, Submission, UserProfile } from "./types.js";

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

export const mpProfiles = [
  {
    id: "mp-delhi-central",
    name: "MP Central Delhi",
    state: "Delhi",
    district: "Central Delhi",
    wards: ["Kalindi Nagar", "River Market"]
  },
  {
    id: "mp-delhi-east",
    name: "MP East Delhi",
    state: "Delhi",
    district: "East Delhi",
    wards: ["East Colony"]
  },
  {
    id: "mp-maharashtra-north",
    name: "MP North Maharashtra",
    state: "Maharashtra",
    district: "Nashik Rural",
    wards: ["North Village"]
  },
  {
    id: "mp-up-lucknow",
    name: "MP Lucknow",
    state: "Uttar Pradesh",
    district: "Lucknow",
    wards: ["Aminabad Basti", "Gomti Nagar Extension"]
  },
  {
    id: "mp-tn-chennai",
    name: "MP Chennai Central",
    state: "Tamil Nadu",
    district: "Chennai",
    wards: ["Perambur School Zone", "Buckingham Canal Ward"]
  },
  {
    id: "mp-wb-kolkata",
    name: "MP Kolkata East",
    state: "West Bengal",
    district: "Kolkata",
    wards: ["Beliaghata Clinic Zone", "Howrah Riverside"]
  },
  {
    id: "mp-ka-bengaluru",
    name: "MP Bengaluru North",
    state: "Karnataka",
    district: "Bengaluru Urban",
    wards: ["Yelahanka Periphery"]
  },
  {
    id: "mp-gj-ahmedabad",
    name: "MP Ahmedabad East",
    state: "Gujarat",
    district: "Ahmedabad",
    wards: ["Odhav Water Line"]
  },
  {
    id: "mp-pb-ludhiana",
    name: "MP Ludhiana",
    state: "Punjab",
    district: "Ludhiana",
    wards: ["Ludhiana South", "Gill Road", "Focal Point", "Samrala Road", "Jagraon Bridge", "Dugri Urban"]
  }
];

export const seedUsers: UserProfile[] = [
  {
    id: "admin-user-shivam",
    role: "state_admin",
    username: "shivam",
    displayName: "Shivam Kumar",
    privacyMode: false,
    location: { state: "Delhi", district: "Central Delhi", ward: "Kalindi Nagar" },
    contributionScore: 100
  },
  {
    id: "u-kalindi-01",
    role: "citizen",
    username: "school-parent",
    displayName: "Local Voice 482",
    privacyMode: true,
    location: { state: "Delhi", district: "Central Delhi", ward: "Kalindi Nagar" },
    contributionScore: 78
  },
  {
    id: "u-river-01",
    role: "citizen",
    username: "market-worker",
    displayName: "market-worker",
    privacyMode: false,
    location: { state: "Delhi", district: "Central Delhi", ward: "River Market" },
    contributionScore: 72
  },
  {
    id: "u-lucknow-01",
    role: "citizen",
    username: "ward-volunteer",
    displayName: "Local Voice 224",
    privacyMode: true,
    location: { state: "Uttar Pradesh", district: "Lucknow", ward: "Aminabad Basti" },
    contributionScore: 81
  },
  {
    id: "u-chennai-01",
    role: "citizen",
    username: "school-teacher",
    displayName: "school-teacher",
    privacyMode: false,
    location: { state: "Tamil Nadu", district: "Chennai", ward: "Perambur School Zone" },
    contributionScore: 84
  },
  {
    id: "mp-user-delhi-central",
    role: "mp",
    username: "mp.central.delhi",
    displayName: "MP Central Delhi",
    privacyMode: false,
    mpId: "mp-delhi-central",
    location: { state: "Delhi", district: "Central Delhi", ward: "Kalindi Nagar" },
    contributionScore: 100
  },
  {
    id: "ward-staff-kalindi",
    role: "ward_staff",
    username: "staff.kalindi",
    displayName: "Ward Staff Kalindi",
    privacyMode: false,
    mpId: "mp-delhi-central",
    location: { state: "Delhi", district: "Central Delhi", ward: "Kalindi Nagar" },
    contributionScore: 92
  },
  {
    id: "district-admin-delhi",
    role: "district_admin",
    username: "admin.central.delhi",
    displayName: "District Admin Central Delhi",
    privacyMode: false,
    location: { state: "Delhi", district: "Central Delhi", ward: "Kalindi Nagar" },
    contributionScore: 100
  },
  {
    id: "state-admin-india",
    role: "state_admin",
    username: "admin.india",
    displayName: "State Admin",
    privacyMode: false,
    location: { state: "Delhi", district: "Central Delhi", ward: "Kalindi Nagar" },
    contributionScore: 100
  }
];

export const areaMappings: AreaMapping[] = mpProfiles.flatMap((mp) =>
  mp.wards.map((ward) => ({
    id: `${mp.id}-${ward.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    state: mp.state,
    district: mp.district,
    ward,
    mpId: mp.id,
    wardStaffUserIds: ward === "Kalindi Nagar" ? ["ward-staff-kalindi"] : [],
    updatedAt: hoursAgo(2)
  }))
);

export const civicDatasets: CivicDataset[] = [
  {
    state: "Delhi",
    district: "Central Delhi",
    ward: "Kalindi Nagar",
    lat: 28.62,
    lng: 77.3,
    mpId: "mp-delhi-central",
    mpName: "MP Central Delhi",
    category: "Education",
    gapScore: 0.9,
    equityScore: 0.82,
    indicators: ["1.7x classroom crowding", "Girls' attendance below ward average", "Low toilet coverage"]
  },
  {
    state: "Delhi",
    district: "Central Delhi",
    ward: "River Market",
    lat: 28.65,
    lng: 77.23,
    mpId: "mp-delhi-central",
    mpName: "MP Central Delhi",
    category: "Roads",
    gapScore: 0.78,
    equityScore: 0.66,
    indicators: ["2.8 km damaged road", "Clinic route affected", "Monsoon flooding reports"]
  },
  {
    state: "Delhi",
    district: "East Delhi",
    ward: "East Colony",
    lat: 28.63,
    lng: 77.29,
    mpId: "mp-delhi-east",
    mpName: "MP East Delhi",
    category: "Health",
    gapScore: 0.72,
    equityScore: 0.86,
    indicators: ["3.9 km median clinic distance", "High elderly share", "Low evening OPD access"]
  },
  {
    state: "Maharashtra",
    district: "Nashik Rural",
    ward: "North Village",
    lat: 20.01,
    lng: 73.79,
    mpId: "mp-maharashtra-north",
    mpName: "MP North Maharashtra",
    category: "Water",
    gapScore: 0.69,
    equityScore: 0.9,
    indicators: ["Intermittent supply", "High tanker dependence", "Low household tap coverage"]
  },
  {
    state: "Uttar Pradesh",
    district: "Lucknow",
    ward: "Aminabad Basti",
    lat: 26.85,
    lng: 80.95,
    mpId: "mp-up-lucknow",
    mpName: "MP Lucknow",
    category: "Sanitation",
    gapScore: 0.84,
    equityScore: 0.88,
    indicators: ["Open drain overflow", "High dengue complaint cluster", "Solid waste pickup gaps"]
  },
  {
    state: "Uttar Pradesh",
    district: "Lucknow",
    ward: "Gomti Nagar Extension",
    lat: 26.86,
    lng: 81.01,
    mpId: "mp-up-lucknow",
    mpName: "MP Lucknow",
    category: "Roads",
    gapScore: 0.73,
    equityScore: 0.61,
    indicators: ["School bus route damaged", "2.1 km last-mile road gap", "High accident complaints"]
  },
  {
    state: "Tamil Nadu",
    district: "Chennai",
    ward: "Perambur School Zone",
    lat: 13.09,
    lng: 80.28,
    mpId: "mp-tn-chennai",
    mpName: "MP Chennai Central",
    category: "Education",
    gapScore: 0.79,
    equityScore: 0.77,
    indicators: ["Science lab unavailable", "High enrollment growth", "Toilet repair pending"]
  },
  {
    state: "Tamil Nadu",
    district: "Chennai",
    ward: "Buckingham Canal Ward",
    lat: 13.05,
    lng: 80.24,
    mpId: "mp-tn-chennai",
    mpName: "MP Chennai Central",
    category: "Sanitation",
    gapScore: 0.81,
    equityScore: 0.8,
    indicators: ["Canal-side waste accumulation", "Drain desilting overdue", "Flood-prone street cluster"]
  },
  {
    state: "West Bengal",
    district: "Kolkata",
    ward: "Beliaghata Clinic Zone",
    lat: 22.57,
    lng: 88.43,
    mpId: "mp-wb-kolkata",
    mpName: "MP Kolkata East",
    category: "Health",
    gapScore: 0.75,
    equityScore: 0.83,
    indicators: ["High outpatient wait time", "Maternal health outreach gap", "Low evening doctor availability"]
  },
  {
    state: "West Bengal",
    district: "Kolkata",
    ward: "Howrah Riverside",
    lat: 22.59,
    lng: 88.31,
    mpId: "mp-wb-kolkata",
    mpName: "MP Kolkata East",
    category: "Power",
    gapScore: 0.68,
    equityScore: 0.74,
    indicators: ["Unlit river approach road", "Women safety complaints", "Transformer outage pattern"]
  },
  {
    state: "Karnataka",
    district: "Bengaluru Urban",
    ward: "Yelahanka Periphery",
    lat: 13.1,
    lng: 77.59,
    mpId: "mp-ka-bengaluru",
    mpName: "MP Bengaluru North",
    category: "Digital Access",
    gapScore: 0.64,
    equityScore: 0.7,
    indicators: ["Low broadband coverage", "Patchy mobile signal", "Digital service access gap"]
  },
  {
    state: "Gujarat",
    district: "Ahmedabad",
    ward: "Odhav Water Line",
    lat: 23.03,
    lng: 72.58,
    mpId: "mp-gj-ahmedabad",
    mpName: "MP Ahmedabad East",
    category: "Water",
    gapScore: 0.71,
    equityScore: 0.69,
    indicators: ["Pipeline pressure loss", "High industrial-area complaints", "Low morning supply reliability"]
  },
  {
    state: "Punjab",
    district: "Ludhiana",
    ward: "Ludhiana South",
    lat: 30.87,
    lng: 75.86,
    mpId: "mp-pb-ludhiana",
    mpName: "MP Ludhiana",
    category: "Roads",
    gapScore: 0.88,
    equityScore: 0.76,
    indicators: ["Pothole cluster near school routes", "Heavy freight corridor damage", "Monsoon waterlogging complaints"]
  },
  {
    state: "Punjab",
    district: "Ludhiana",
    ward: "Gill Road",
    lat: 30.86,
    lng: 75.84,
    mpId: "mp-pb-ludhiana",
    mpName: "MP Ludhiana",
    category: "Water",
    gapScore: 0.78,
    equityScore: 0.82,
    indicators: ["Low morning pressure", "Pipeline leakage reports", "Tanker dependence in dense lanes"]
  },
  {
    state: "Punjab",
    district: "Ludhiana",
    ward: "Focal Point",
    lat: 30.89,
    lng: 75.91,
    mpId: "mp-pb-ludhiana",
    mpName: "MP Ludhiana",
    category: "Health",
    gapScore: 0.74,
    equityScore: 0.79,
    indicators: ["PHC crowding", "Industrial worker clinic access gap", "Evening OPD demand"]
  },
  {
    state: "Punjab",
    district: "Ludhiana",
    ward: "Samrala Road",
    lat: 30.91,
    lng: 75.88,
    mpId: "mp-pb-ludhiana",
    mpName: "MP Ludhiana",
    category: "Education",
    gapScore: 0.67,
    equityScore: 0.73,
    indicators: ["School toilet repairs pending", "Classroom crowding", "Drainage outside school gate"]
  },
  {
    state: "Punjab",
    district: "Ludhiana",
    ward: "Jagraon Bridge",
    lat: 30.92,
    lng: 75.85,
    mpId: "mp-pb-ludhiana",
    mpName: "MP Ludhiana",
    category: "Power",
    gapScore: 0.63,
    equityScore: 0.68,
    indicators: ["Streetlight outage", "Transformer complaint cluster", "Unsafe pedestrian approach"]
  },
  {
    state: "Punjab",
    district: "Ludhiana",
    ward: "Dugri Urban",
    lat: 30.85,
    lng: 75.82,
    mpId: "mp-pb-ludhiana",
    mpName: "MP Ludhiana",
    category: "Sanitation",
    gapScore: 0.72,
    equityScore: 0.75,
    indicators: ["Drain desilting overdue", "Garbage pickup misses", "Flooding after rain"]
  }
];

export const sourceSnapshots: SourceSnapshot[] = civicDatasets.map((dataset, index) => ({
  id: `src-${dataset.state.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${dataset.ward.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${dataset.category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  source:
    dataset.category === "Education"
      ? "education"
      : dataset.category === "Roads"
        ? "roads"
        : dataset.category === "Health"
          ? "health"
          : dataset.category === "Water"
            ? "water"
            : dataset.category === "Power"
              ? "power"
              : dataset.category === "Digital Access"
                ? "digital"
                : "sanitation",
  version: `fixture-2026-06-${String(10 + index).padStart(2, "0")}`,
  state: dataset.state,
  district: dataset.district,
  ward: dataset.ward,
  capturedAt: hoursAgo(72 - index),
  rowCount: 1,
  freshness: index < 10 ? "fresh" : "stale",
  metrics: {
    gapScore: dataset.gapScore,
    equityScore: dataset.equityScore,
    indicatorCount: dataset.indicators.length
  }
}));

export const seedSubmissions: Submission[] = [
  {
    id: "s-001",
    userId: "u-kalindi-01",
    username: "school-parent",
    displayName: "Local Voice 482",
    privacyMode: true,
    state: "Delhi",
    district: "Central Delhi",
    mpId: "mp-delhi-central",
    channel: "whatsapp",
    language: "Hindi",
    detectedLanguage: "English",
    normalizedText: "Government school toilets are broken and children miss class after rain.",
    category: "Education",
    ward: "Kalindi Nagar",
    urgency: 5,
    rating: 5,
    citizenScore: 82,
    text: "Government school toilets are broken and children miss class after rain.",
    createdAt: hoursAgo(42)
  },
  {
    id: "s-002",
    userId: "u-kalindi-02",
    username: "parent-voice",
    displayName: "Local Voice 917",
    privacyMode: true,
    state: "Delhi",
    district: "Central Delhi",
    mpId: "mp-delhi-central",
    channel: "voice",
    language: "Tamil",
    detectedLanguage: "English",
    normalizedText: "Classrooms flood and there are not enough benches in school.",
    category: "Education",
    ward: "Kalindi Nagar",
    urgency: 4,
    rating: 4,
    citizenScore: 76,
    text: "Classrooms flood and there are not enough benches in school.",
    createdAt: hoursAgo(39)
  },
  {
    id: "s-003",
    userId: "u-river-01",
    username: "market-worker",
    displayName: "market-worker",
    privacyMode: false,
    state: "Delhi",
    district: "Central Delhi",
    mpId: "mp-delhi-central",
    channel: "photo",
    language: "English",
    detectedLanguage: "English",
    normalizedText: "Large potholes on the road near the river market delay ambulance movement.",
    category: "Roads",
    ward: "River Market",
    urgency: 5,
    rating: 5,
    citizenScore: 80,
    text: "Large potholes on the road near the river market delay ambulance movement.",
    createdAt: hoursAgo(37)
  },
  {
    id: "s-004",
    userId: "u-east-01",
    username: "clinic-helper",
    displayName: "clinic-helper",
    privacyMode: false,
    state: "Delhi",
    district: "East Delhi",
    mpId: "mp-delhi-east",
    channel: "text",
    language: "Bangla",
    detectedLanguage: "English",
    normalizedText: "Evening clinic is needed because elderly people cannot travel far.",
    category: "Health",
    ward: "East Colony",
    urgency: 4,
    rating: 4,
    citizenScore: 74,
    text: "Evening clinic is needed because elderly people cannot travel far.",
    createdAt: hoursAgo(35)
  },
  {
    id: "s-005",
    userId: "u-north-01",
    username: "water-group",
    displayName: "Local Voice 303",
    privacyMode: true,
    state: "Maharashtra",
    district: "Nashik Rural",
    mpId: "mp-maharashtra-north",
    channel: "whatsapp",
    language: "Marathi",
    detectedLanguage: "English",
    normalizedText: "Drinking water comes only twice a week and tankers are costly.",
    category: "Water",
    ward: "North Village",
    urgency: 3,
    rating: 4,
    citizenScore: 70,
    text: "Drinking water comes only twice a week and tankers are costly.",
    createdAt: hoursAgo(31)
  },
  {
    id: "s-006",
    userId: "u-lucknow-01",
    username: "ward-volunteer",
    displayName: "Local Voice 224",
    privacyMode: true,
    state: "Uttar Pradesh",
    district: "Lucknow",
    mpId: "mp-up-lucknow",
    channel: "whatsapp",
    language: "Hindi",
    detectedLanguage: "English",
    normalizedText: "Open drains overflow near the basti and garbage pickup misses three lanes.",
    category: "Sanitation",
    ward: "Aminabad Basti",
    urgency: 5,
    rating: 5,
    citizenScore: 86,
    text: "Open drains overflow near the basti and garbage pickup misses three lanes.",
    createdAt: hoursAgo(30)
  },
  {
    id: "s-007",
    userId: "u-lucknow-02",
    username: "anganwadi-worker",
    displayName: "Local Voice 511",
    privacyMode: true,
    state: "Uttar Pradesh",
    district: "Lucknow",
    mpId: "mp-up-lucknow",
    channel: "voice",
    language: "Hindi",
    detectedLanguage: "English",
    normalizedText: "Children cross a broken road near the school bus stop in Gomti Nagar Extension.",
    category: "Roads",
    ward: "Gomti Nagar Extension",
    urgency: 4,
    rating: 4,
    citizenScore: 77,
    text: "Children cross a broken road near the school bus stop in Gomti Nagar Extension.",
    createdAt: hoursAgo(28)
  },
  {
    id: "s-008",
    userId: "u-lucknow-03",
    username: "resident-group",
    displayName: "Local Voice 818",
    privacyMode: true,
    state: "Uttar Pradesh",
    district: "Lucknow",
    mpId: "mp-up-lucknow",
    channel: "photo",
    language: "Hindi",
    detectedLanguage: "English",
    normalizedText: "Drain water enters homes during rain and waste blocks the lane.",
    category: "Sanitation",
    ward: "Aminabad Basti",
    urgency: 5,
    rating: 4,
    citizenScore: 83,
    text: "Drain water enters homes during rain and waste blocks the lane.",
    createdAt: hoursAgo(26)
  },
  {
    id: "s-009",
    userId: "u-chennai-01",
    username: "school-teacher",
    displayName: "school-teacher",
    privacyMode: false,
    state: "Tamil Nadu",
    district: "Chennai",
    mpId: "mp-tn-chennai",
    channel: "text",
    language: "Tamil",
    detectedLanguage: "English",
    normalizedText: "The school science lab is closed and toilets need repair for girls.",
    category: "Education",
    ward: "Perambur School Zone",
    urgency: 4,
    rating: 5,
    citizenScore: 80,
    text: "The school science lab is closed and toilets need repair for girls.",
    createdAt: hoursAgo(24)
  },
  {
    id: "s-010",
    userId: "u-chennai-02",
    username: "canal-resident",
    displayName: "Local Voice 640",
    privacyMode: true,
    state: "Tamil Nadu",
    district: "Chennai",
    mpId: "mp-tn-chennai",
    channel: "photo",
    language: "Tamil",
    detectedLanguage: "English",
    normalizedText: "Waste is dumped beside the canal and drains overflow after rain.",
    category: "Sanitation",
    ward: "Buckingham Canal Ward",
    urgency: 5,
    rating: 5,
    citizenScore: 87,
    text: "Waste is dumped beside the canal and drains overflow after rain.",
    createdAt: hoursAgo(23)
  },
  {
    id: "s-011",
    userId: "u-kolkata-01",
    username: "health-volunteer",
    displayName: "Local Voice 292",
    privacyMode: true,
    state: "West Bengal",
    district: "Kolkata",
    mpId: "mp-wb-kolkata",
    channel: "whatsapp",
    language: "Bangla",
    detectedLanguage: "English",
    normalizedText: "The local clinic has long waiting time and no evening doctor for working families.",
    category: "Health",
    ward: "Beliaghata Clinic Zone",
    urgency: 4,
    rating: 4,
    citizenScore: 78,
    text: "The local clinic has long waiting time and no evening doctor for working families.",
    createdAt: hoursAgo(20)
  },
  {
    id: "s-012",
    userId: "u-kolkata-02",
    username: "riverside-shop",
    displayName: "riverside-shop",
    privacyMode: false,
    state: "West Bengal",
    district: "Kolkata",
    mpId: "mp-wb-kolkata",
    channel: "text",
    language: "Bangla",
    detectedLanguage: "English",
    normalizedText: "Streetlights near the riverside road fail every week and the area is unsafe at night.",
    category: "Power",
    ward: "Howrah Riverside",
    urgency: 4,
    rating: 5,
    citizenScore: 79,
    text: "Streetlights near the riverside road fail every week and the area is unsafe at night.",
    createdAt: hoursAgo(18)
  },
  {
    id: "s-013",
    userId: "u-bengaluru-01",
    username: "student-group",
    displayName: "Local Voice 734",
    privacyMode: true,
    state: "Karnataka",
    district: "Bengaluru Urban",
    mpId: "mp-ka-bengaluru",
    channel: "whatsapp",
    language: "Kannada",
    detectedLanguage: "English",
    normalizedText: "Mobile network is weak and students cannot access online services reliably.",
    category: "Digital Access",
    ward: "Yelahanka Periphery",
    urgency: 3,
    rating: 4,
    citizenScore: 69,
    text: "Mobile network is weak and students cannot access online services reliably.",
    createdAt: hoursAgo(16)
  },
  {
    id: "s-014",
    userId: "u-ahmedabad-01",
    username: "factory-lane",
    displayName: "Local Voice 109",
    privacyMode: true,
    state: "Gujarat",
    district: "Ahmedabad",
    mpId: "mp-gj-ahmedabad",
    channel: "voice",
    language: "Gujarati",
    detectedLanguage: "English",
    normalizedText: "Water pressure is low in the morning and the pipeline leaks near the industrial lane.",
    category: "Water",
    ward: "Odhav Water Line",
    urgency: 4,
    rating: 4,
    citizenScore: 75,
    text: "Water pressure is low in the morning and the pipeline leaks near the industrial lane.",
    createdAt: hoursAgo(14)
  },
  {
    id: "s-015",
    userId: "u-chennai-03",
    username: "parent-association",
    displayName: "Local Voice 651",
    privacyMode: true,
    state: "Tamil Nadu",
    district: "Chennai",
    mpId: "mp-tn-chennai",
    channel: "whatsapp",
    language: "Tamil",
    detectedLanguage: "English",
    normalizedText: "Enrollment increased but the school still has no usable science lab.",
    category: "Education",
    ward: "Perambur School Zone",
    urgency: 3,
    rating: 4,
    citizenScore: 72,
    text: "Enrollment increased but the school still has no usable science lab.",
    createdAt: hoursAgo(12)
  },
  {
    id: "s-016",
    userId: "u-kolkata-03",
    username: "women-collective",
    displayName: "Local Voice 515",
    privacyMode: true,
    state: "West Bengal",
    district: "Kolkata",
    mpId: "mp-wb-kolkata",
    channel: "voice",
    language: "Bangla",
    detectedLanguage: "English",
    normalizedText: "The streetlight outage makes the riverside approach unsafe for women after sunset.",
    category: "Power",
    ward: "Howrah Riverside",
    urgency: 5,
    rating: 5,
    citizenScore: 84,
    text: "The streetlight outage makes the riverside approach unsafe for women after sunset.",
    createdAt: hoursAgo(10)
  },
  {
    id: "s-017",
    userId: "u-east-02",
    username: "elder-care",
    displayName: "Local Voice 388",
    privacyMode: true,
    state: "Delhi",
    district: "East Delhi",
    mpId: "mp-delhi-east",
    channel: "whatsapp",
    language: "Hindi",
    detectedLanguage: "English",
    normalizedText: "Elderly residents need a closer evening clinic and medicine counter.",
    category: "Health",
    ward: "East Colony",
    urgency: 5,
    rating: 4,
    citizenScore: 82,
    text: "Elderly residents need a closer evening clinic and medicine counter.",
    createdAt: hoursAgo(8)
  },
  {
    id: "s-018",
    userId: "u-river-02",
    username: "ambulance-driver",
    displayName: "Local Voice 277",
    privacyMode: true,
    state: "Delhi",
    district: "Central Delhi",
    mpId: "mp-delhi-central",
    channel: "voice",
    language: "Hindi",
    detectedLanguage: "English",
    normalizedText: "Ambulances slow down because potholes on the market road are deep.",
    category: "Roads",
    ward: "River Market",
    urgency: 5,
    rating: 5,
    citizenScore: 85,
    text: "Ambulances slow down because potholes on the market road are deep.",
    createdAt: hoursAgo(6)
  }
];

const presentationDemoAreas = [
  { ward: "Ludhiana South", category: "Roads", base: "Road cave-ins and potholes slow school buses and ambulances after rain.", urgency: 5, rating: 5, channel: "photo" },
  { ward: "Gill Road", category: "Water", base: "Water pressure is low and leakage is visible near the main market pipeline.", urgency: 4, rating: 4, channel: "whatsapp" },
  { ward: "Focal Point", category: "Health", base: "Industrial workers report long PHC queues and no evening doctor after shifts.", urgency: 4, rating: 5, channel: "voice" },
  { ward: "Samrala Road", category: "Education", base: "School toilets need repairs and water collects near the gate during rain.", urgency: 4, rating: 4, channel: "text" },
  { ward: "Jagraon Bridge", category: "Power", base: "Streetlights fail near the bridge approach and the pedestrian stretch feels unsafe.", urgency: 4, rating: 5, channel: "whatsapp" },
  { ward: "Dugri Urban", category: "Sanitation", base: "Drain desilting is overdue and garbage pickup misses inner lanes.", urgency: 5, rating: 4, channel: "photo" }
] satisfies Array<{ ward: string; category: string; base: string; urgency: number; rating: number; channel: Submission["channel"] }>;

const presentationDemoVariants = [
  "Residents say the issue has repeated for three weeks.",
  "Ward volunteers reported the same problem during the last public meeting.",
  "Senior citizens and school children are most affected.",
  "Local shopkeepers say traffic and access are getting worse.",
  "Photos and voice notes mention the same hotspot repeatedly.",
  "Citizens asked for inspection before the next rain spell."
];

const presentationDelhiDemoAreas = [
  { district: "Central Delhi", ward: "Kalindi Nagar", mpId: "mp-delhi-central", category: "Education", base: "Government school toilets are broken and two classrooms flood after rain.", urgency: 5, rating: 5, channel: "whatsapp" },
  { district: "Central Delhi", ward: "Kalindi Nagar", mpId: "mp-delhi-central", category: "Water", base: "A drinking water line leaks near the school lane and pressure drops before noon.", urgency: 4, rating: 4, channel: "photo" },
  { district: "Central Delhi", ward: "Kalindi Nagar", mpId: "mp-delhi-central", category: "Sanitation", base: "The drain outside the school gate blocks after every market day.", urgency: 4, rating: 4, channel: "text" },
  { district: "Central Delhi", ward: "Kalindi Nagar", mpId: "mp-delhi-central", category: "Roads", base: "The approach road to the school has potholes and waterlogging near the bus stop.", urgency: 5, rating: 5, channel: "voice" },
  { district: "Central Delhi", ward: "River Market", mpId: "mp-delhi-central", category: "Roads", base: "Deep potholes on the river market road slow ambulances and delivery vehicles.", urgency: 5, rating: 5, channel: "photo" },
  { district: "Central Delhi", ward: "River Market", mpId: "mp-delhi-central", category: "Power", base: "Streetlights near the river approach fail at night and pedestrians feel unsafe.", urgency: 4, rating: 5, channel: "whatsapp" },
  { district: "Central Delhi", ward: "River Market", mpId: "mp-delhi-central", category: "Water", base: "Market taps run dry during peak hours and tanker dependency is increasing.", urgency: 4, rating: 4, channel: "text" },
  { district: "East Delhi", ward: "East Colony", mpId: "mp-delhi-east", category: "Health", base: "Elderly residents need an evening clinic and regular medicine counter.", urgency: 5, rating: 4, channel: "voice" },
  { district: "East Delhi", ward: "East Colony", mpId: "mp-delhi-east", category: "Sanitation", base: "Garbage collection misses inner lanes and drain covers are damaged.", urgency: 4, rating: 4, channel: "photo" },
  { district: "East Delhi", ward: "East Colony", mpId: "mp-delhi-east", category: "Digital Access", base: "Mobile network is weak near the community centre and students cannot attend online sessions.", urgency: 3, rating: 4, channel: "whatsapp" }
] satisfies Array<{ district: string; ward: string; mpId: string; category: string; base: string; urgency: number; rating: number; channel: Submission["channel"] }>;

const presentationDelhiDemoVariants = [
  "The same complaint came through the ward office twice this week.",
  "Residents attached location details and asked for inspection before the next public meeting.",
  "Women, senior citizens, and school children are mentioned as the most affected groups.",
  "Local volunteers reported that the issue overlaps with traffic and safety concerns.",
  "The MP office needs a presentation-ready evidence cluster for this locality."
];

export const presentationDemoSubmissions: Submission[] = presentationDemoAreas.flatMap((area, areaIndex) =>
  presentationDemoVariants.map((variant, variantIndex) => {
    const serial = areaIndex * presentationDemoVariants.length + variantIndex + 1;
    const text = `${area.base} ${variant}`;
    return {
      id: `demo-pb-ludhiana-${String(serial).padStart(3, "0")}`,
      userId: `demo-pb-user-${String(serial).padStart(3, "0")}`,
      username: `ludhiana-demo-${String(serial).padStart(3, "0")}`,
      displayName: `Local Voice ${300 + serial}`,
      privacyMode: true,
      state: "Punjab",
      district: "Ludhiana",
      mpId: "mp-pb-ludhiana",
      channel: area.channel,
      language: variantIndex % 2 === 0 ? "Punjabi" : "Hindi",
      detectedLanguage: "English",
      normalizedText: text,
      category: area.category,
      ward: area.ward,
      urgency: Math.max(3, area.urgency - (variantIndex % 2)),
      rating: Math.max(3, area.rating - (variantIndex % 3 === 0 ? 1 : 0)),
      citizenScore: 72 + ((serial * 3) % 18),
      text,
      createdAt: hoursAgo(5 + serial),
      processedAt: hoursAgo(4 + serial),
      processingStatus: "processed",
      rawIntakeId: `demo-${String(serial).padStart(8, "0")}`,
      batchId: "demo-punjab-ludhiana"
    };
  })
);

export const presentationDelhiDemoSubmissions: Submission[] = presentationDelhiDemoAreas.flatMap((area, areaIndex) =>
  presentationDelhiDemoVariants.map((variant, variantIndex) => {
    const serial = areaIndex * presentationDelhiDemoVariants.length + variantIndex + 1;
    const text = `${area.base} ${variant}`;
    return {
      id: `demo-delhi-${String(serial).padStart(3, "0")}`,
      userId: `demo-delhi-user-${String(serial).padStart(3, "0")}`,
      username: `delhi-demo-${String(serial).padStart(3, "0")}`,
      displayName: `Delhi Voice ${500 + serial}`,
      privacyMode: true,
      state: "Delhi",
      district: area.district,
      mpId: area.mpId,
      channel: area.channel,
      language: variantIndex % 2 === 0 ? "Hindi" : "English",
      detectedLanguage: "English",
      normalizedText: text,
      category: area.category,
      ward: area.ward,
      urgency: Math.max(3, area.urgency - (variantIndex % 3 === 0 ? 1 : 0)),
      rating: Math.max(3, area.rating - (variantIndex % 4 === 0 ? 1 : 0)),
      citizenScore: 74 + ((serial * 5) % 20),
      text,
      createdAt: hoursAgo(2 + serial),
      processedAt: hoursAgo(1 + serial),
      processingStatus: "processed",
      rawIntakeId: `delhi-demo-${String(serial).padStart(6, "0")}`,
      batchId: "demo-delhi-local"
    };
  })
);

export const demoSubmissions: Submission[] = [...seedSubmissions, ...presentationDemoSubmissions, ...presentationDelhiDemoSubmissions];
