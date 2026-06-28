import { CivicDataset, Submission } from "./types.js";

export const civicDatasets: CivicDataset[] = [
  {
    ward: "Kalindi Nagar",
    category: "Education",
    gapScore: 0.9,
    equityScore: 0.82,
    indicators: ["1.7x classroom crowding", "Girls' attendance below ward average", "Low toilet coverage"]
  },
  {
    ward: "River Market",
    category: "Roads",
    gapScore: 0.78,
    equityScore: 0.66,
    indicators: ["2.8 km damaged road", "Clinic route affected", "Monsoon flooding reports"]
  },
  {
    ward: "East Colony",
    category: "Health",
    gapScore: 0.72,
    equityScore: 0.86,
    indicators: ["3.9 km median clinic distance", "High elderly share", "Low evening OPD access"]
  },
  {
    ward: "North Village",
    category: "Water",
    gapScore: 0.69,
    equityScore: 0.9,
    indicators: ["Intermittent supply", "High tanker dependence", "Low household tap coverage"]
  }
];

export const seedSubmissions: Submission[] = [
  {
    id: "s-001",
    channel: "whatsapp",
    language: "Hindi",
    ward: "Kalindi Nagar",
    urgency: 5,
    text: "Government school toilets are broken and children miss class after rain.",
    createdAt: new Date(Date.now() - 86_400_000).toISOString()
  },
  {
    id: "s-002",
    channel: "voice",
    language: "Tamil",
    ward: "Kalindi Nagar",
    urgency: 4,
    text: "Classrooms flood and there are not enough benches in school.",
    createdAt: new Date(Date.now() - 79_400_000).toISOString()
  },
  {
    id: "s-003",
    channel: "photo",
    language: "English",
    ward: "River Market",
    urgency: 5,
    text: "Large potholes on the road near the river market delay ambulance movement.",
    createdAt: new Date(Date.now() - 74_400_000).toISOString()
  },
  {
    id: "s-004",
    channel: "text",
    language: "Bangla",
    ward: "East Colony",
    urgency: 4,
    text: "Evening clinic is needed because elderly people cannot travel far.",
    createdAt: new Date(Date.now() - 64_400_000).toISOString()
  },
  {
    id: "s-005",
    channel: "whatsapp",
    language: "Marathi",
    ward: "North Village",
    urgency: 3,
    text: "Drinking water comes only twice a week and tankers are costly.",
    createdAt: new Date(Date.now() - 54_400_000).toISOString()
  }
];
