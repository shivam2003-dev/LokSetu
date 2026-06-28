import { CivicDataset, Submission, UserProfile } from "./types.js";

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
  }
];

export const seedUsers: UserProfile[] = [
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
  }
];

export const civicDatasets: CivicDataset[] = [
  {
    state: "Delhi",
    district: "Central Delhi",
    ward: "Kalindi Nagar",
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
    mpId: "mp-maharashtra-north",
    mpName: "MP North Maharashtra",
    category: "Water",
    gapScore: 0.69,
    equityScore: 0.9,
    indicators: ["Intermittent supply", "High tanker dependence", "Low household tap coverage"]
  }
];

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
    createdAt: new Date(Date.now() - 86_400_000).toISOString()
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
    createdAt: new Date(Date.now() - 79_400_000).toISOString()
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
    createdAt: new Date(Date.now() - 74_400_000).toISOString()
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
    createdAt: new Date(Date.now() - 64_400_000).toISOString()
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
    createdAt: new Date(Date.now() - 54_400_000).toISOString()
  }
];
