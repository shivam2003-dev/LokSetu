/**
 * Hand-written seed translations for the citizen app UI.
 *
 * These work offline (no AI translation provider required) and are the source
 * of truth for the languages included here. For all other languages the
 * /api/citizen/ui-translations endpoint falls back to AI translation.
 *
 * Keys are the exact English source strings used in apps/citizen (the app uses
 * "default language as key" i18n). Any string not present here falls back to
 * English on the client.
 */

type UiDictionary = Record<string, string>;

// Hindi — reviewed, safe for production.
const hindi: UiDictionary = {
  "Your voice reaches your MP": "आपकी आवाज़ आपके सांसद तक पहुँचती है",
  Logout: "लॉग आउट",
  "What is the problem?": "क्या समस्या है?",
  "Report a local issue in seconds through the protected LokSetu intake.":
    "सुरक्षित लोकसेतु प्रणाली से कुछ ही सेकंड में अपनी स्थानीय समस्या दर्ज करें।",
  "How to get 100% reward": "100% इनाम कैसे पाएँ",
  "Take a photo": "फ़ोटो खींचें",
  Speak: "बोलकर बताएं",
  Type: "लिखें",
  "Pothole, garbage, broken tap": "गड्ढा, कचरा, टूटा नल",
  "Record in any language": "किसी भी भाषा में रिकॉर्ड करें",
  "Write the problem": "समस्या लिखें",
  "Prefer WhatsApp? Send us a message": "व्हाट्सएप पसंद है? हमें संदेश भेजें",
  "Your name stays private. AI removes personal details before your MP sees it.":
    "आपका नाम गोपनीय रहता है। सांसद के देखने से पहले AI व्यक्तिगत जानकारी हटा देता है।",
  "My reward total": "मेरा कुल इनाम",
  "Show my reward total": "मेरा कुल इनाम दिखाएँ",
  "See cumulative reward points, milestone reached, and pending reports.":
    "कुल इनाम अंक, प्राप्त पड़ाव और लंबित रिपोर्ट देखें।",
  "No processed rewards yet. Submitted reports appear here after AI batch scoring.":
    "अभी कोई इनाम संसाधित नहीं हुआ। AI बैच स्कोरिंग के बाद रिपोर्ट यहाँ दिखेंगी।",
  "Track receipt": "रसीद ट्रैक करें",
  Search: "खोजें",
  Status: "स्थिति",
  Area: "क्षेत्र",
  Back: "वापस",
  "100% reward guide": "100% इनाम गाइड",
  Language: "भाषा",
  "Auto-detect language": "भाषा स्वतः पहचानें",
  "Photo of the problem": "समस्या की फ़ोटो",
  "Tap to open camera": "कैमरा खोलने के लिए टैप करें",
  "or choose from gallery": "या गैलरी से चुनें",
  "Retake / choose another": "दोबारा लें / दूसरी चुनें",
  "Record your voice": "अपनी आवाज़ रिकॉर्ड करें",
  "Tap to stop": "रोकने के लिए टैप करें",
  "Record again": "दोबारा रिकॉर्ड करें",
  "Tap to speak": "बोलने के लिए टैप करें",
  "Listening…": "सुन रहे हैं…",
  "Hindi, Tamil, Bangla, Marathi, English — any language":
    "हिन्दी, तमिल, बांग्ला, मराठी, अंग्रेज़ी — कोई भी भाषा",
  "Listen once before submitting. Record again if needed.":
    "जमा करने से पहले एक बार सुनें। ज़रूरत हो तो दोबारा रिकॉर्ड करें।",
  "Describe the problem": "समस्या का विवरण दें",
  "E.g. School toilets are broken and classrooms flood after rain.":
    "जैसे: स्कूल के शौचालय टूटे हैं और बारिश के बाद कक्षाओं में पानी भर जाता है।",
  "Add a note (optional)": "एक टिप्पणी जोड़ें (वैकल्पिक)",
  "Anything to add": "जोड़ने के लिए कुछ भी",
  "Auto-detected area": "स्वतः पहचाना गया क्षेत्र",
  "Location required": "स्थान आवश्यक है",
  Enable: "चालू करें",
  "Sending to your MP…": "आपके सांसद को भेजा जा रहा है…",
  "Submit problem": "समस्या जमा करें",
  "Allow location to submit": "जमा करने के लिए स्थान की अनुमति दें",
  "Submitted. Thank you!": "जमा हो गई। धन्यवाद!",
  "AI batch": "AI बैच",
  "Reward pending": "इनाम लंबित",
  "Receipt ID": "रसीद आईडी",
  Aadhaar: "आधार",
  "format checked": "प्रारूप जाँचा गया",
  "Search this receipt": "यह रसीद खोजें",
  "Report another problem": "एक और समस्या दर्ज करें",
  "+ More languages": "+ और भाषाएँ",
  "Choose your language": "अपनी भाषा चुनें",
  Close: "बंद करें",
  "Select a language": "एक भाषा चुनें",
  "Pick any Indian language. Your voice or text can still be in any language — this sets your preference.":
    "कोई भी भारतीय भाषा चुनें। आपकी आवाज़ या टेक्स्ट किसी भी भाषा में हो सकता है — यह सिर्फ़ आपकी पसंद तय करता है।",
  "Auto-detect": "स्वतः पहचानें",
  "Detect from what you write or say": "आप जो लिखें या बोलें उससे पहचानें",
  Local: "स्थानीय",
  "Reward guide": "इनाम गाइड",
  "How to report well and earn 100% reward": "अच्छी रिपोर्ट कैसे करें और 100% इनाम पाएँ",
  "Cumulative reward": "कुल इनाम",
  "points till date": "अब तक के अंक",
  "Current milestone": "वर्तमान पड़ाव",
  "Next milestone": "अगला पड़ाव",
  "Top milestone reached": "सर्वोच्च पड़ाव प्राप्त",
  // Login screen
  "Aadhaar access uses 12-digit format check only.":
    "आधार पहुँच केवल 12-अंकों के प्रारूप की जाँच करती है।",
  "Aadhaar number": "आधार संख्या",
  Continue: "आगे बढ़ें",
  "Check cumulative reward": "कुल इनाम जाँचें",
  "Enter a 12-digit Aadhaar number.": "12 अंकों की आधार संख्या दर्ज करें।"
};

const dictionaries: Record<string, UiDictionary> = {
  hindi
};

/** Return the citizen app seed dictionary for a language. */
export function seedUiTranslations(language: string): UiDictionary | null {
  return dictionaries[language.trim().toLowerCase()] ?? null;
}

// ── JanVaani web console Hindi seed ──────────────────────────────────────────
const webHindi: UiDictionary = {
  // Navigation
  "Overview": "अवलोकन",
  "Demand Signals": "माँग संकेत",
  "AI Assistant (RAG)": "AI सहायक",
  "Recommendations": "सिफ़ारिशें",
  "Projects": "परियोजनाएँ",
  "Reports": "रिपोर्ट",
  "Data Explorer": "डेटा एक्सप्लोरर",
  "Knowledge Base": "ज्ञान आधार",
  "Map View": "मानचित्र दृश्य",
  "Compare": "तुलना",
  "Settings": "सेटिंग्स",
  "Core workflow": "मुख्य कार्यप्रवाह",
  "JanVaani AI": "जनवाणी AI",
  "Constituency Intelligence Platform": "निर्वाचन क्षेत्र बुद्धिमत्ता मंच",
  "Open JanVaani": "जनवाणी खोलें",
  "Logout": "लॉग आउट",
  "Refresh data": "डेटा रीफ्रेश करें",
  "Tour": "भ्रमण",
  "Menu": "मेनू",

  // Login
  "Welcome Back": "वापस स्वागत है",
  "Sign in to continue to JanVaani AI": "जनवाणी AI जारी रखने के लिए साइन इन करें",
  "Email or Mobile Number": "ईमेल या मोबाइल नंबर",
  "Enter your email or mobile number": "अपना ईमेल या मोबाइल नंबर दर्ज करें",
  "Password": "पासवर्ड",
  "Enter your password": "अपना पासवर्ड दर्ज करें",
  "Show password": "पासवर्ड दिखाएँ",
  "Hide password": "पासवर्ड छुपाएँ",
  "Remember me": "मुझे याद रखें",
  "Forgot Password?": "पासवर्ड भूल गए?",
  "Sign In": "साइन इन",
  "Don't have an account?": "खाता नहीं है?",
  "Contact Administrator": "प्रशासक से संपर्क करें",
  "People's Priorities. Smart Governance.": "जन प्राथमिकताएँ। स्मार्ट शासन।",

  // Overview
  "Constituency intelligence command center": "निर्वाचन क्षेत्र खुफिया कमांड सेंटर",
  "Open AI recommendations": "AI सिफ़ारिशें खोलें",
  "Review projects": "परियोजनाएँ समीक्षा करें",
  "View GIS map": "GIS मानचित्र देखें",
  "Citizen Priorities": "नागरिक प्राथमिकताएँ",
  "Development Progress": "विकास प्रगति",
  "Active Wards": "सक्रिय वार्ड",
  "AI Risk": "AI जोखिम",
  "Top Citizen Priorities": "शीर्ष नागरिक प्राथमिकताएँ",
  "AI Insights": "AI अंतर्दृष्टि",
  "Ask JanVaani AI": "जनवाणी AI से पूछें",
  "Real-Time Alerts": "रियल-टाइम अलर्ट",
  "Demand Hotspots": "माँग हॉटस्पॉट",
  "Aggregate Health": "समग्र स्वास्थ्य",
  "Healthy": "स्वस्थ",
  "Moderate": "मध्यम",
  "Needs attention": "ध्यान चाहिए",
  "AI confidence": "AI विश्वास",
  "citizen signals": "नागरिक संकेत",
  "ward": "वार्ड",
  "wards": "वार्ड",

  // Recommendations
  "AI Recommendations": "AI सिफ़ारिशें",
  "Prioritized development investments": "प्राथमिकता वाले विकास निवेश",
  "Budget": "बजट",
  "Beneficiaries": "लाभार्थी",
  "Top Confidence": "शीर्ष विश्वास",
  "High Priority": "उच्च प्राथमिकता",
  "AI-Ranked Recommendations": "AI-रैंक की गई सिफ़ारिशें",
  "Affected Regions Map": "प्रभावित क्षेत्र मानचित्र",
  "AI Reasoning": "AI तर्क",
  "High": "उच्च",
  "Medium": "मध्यम",
  "Low": "कम",
  "Project Ranking Table": "परियोजना रैंकिंग तालिका",
  "Project": "परियोजना",
  "Category": "श्रेणी",
  "Score": "स्कोर",
  "Priority": "प्राथमिकता",
  "Jump to": "यहाँ जाएँ",
  "Analytics": "विश्लेषण",
  "Full Table": "पूरी तालिका",

  // Projects
  "MP Project Command Center": "सांसद परियोजना कमांड सेंटर",
  "Development projects management": "विकास परियोजनाएँ प्रबंधन",
  "Ongoing": "जारी",
  "Completed": "पूर्ण",
  "Delayed": "विलंबित",
  "Proposed": "प्रस्तावित",
  "Risk": "जोखिम",
  "Kanban Board": "कानबान बोर्ड",
  "Timeline": "समय-रेखा",
  "District Project Map": "जिला परियोजना मानचित्र",
  "Expenditure Tracking": "व्यय ट्रैकिंग",
  "Milestone Tracker": "मील-पत्थर ट्रैकर",
  "Delay Alerts": "देरी अलर्ट",
  "Documents and Media": "दस्तावेज़ और मीडिया",

  // Reports
  "Official AI Reports": "आधिकारिक AI रिपोर्ट",
  "Generate constituency briefings": "निर्वाचन क्षेत्र ब्रीफिंग बनाएँ",
  "Export PDF": "PDF निर्यात करें",
  "Export Word": "Word निर्यात करें",
  "Export PPT": "PPT निर्यात करें",
  "Share Answer": "उत्तर साझा करें",
  "Report Preview": "रिपोर्ट पूर्वावलोकन",
  "AI Executive Summary": "AI कार्यकारी सारांश",
  "Scheduled Reports": "निर्धारित रिपोर्ट",
  "Map Snapshot": "मानचित्र स्नैपशॉट",
  "Citations": "उद्धरण",

  // Copilot
  "Grounded AI Assistant": "आधारित AI सहायक",
  "Ask anything. Answers are backed by real data and sources.": "कुछ भी पूछें। उत्तर वास्तविक डेटा और स्रोतों पर आधारित हैं।",
  "History": "इतिहास",
  "New Query": "नई क्वेरी",
  "Ask AI": "AI से पूछें",
  "Expected Impact": "अपेक्षित प्रभाव",
  "Citizens benefited": "लाभान्वित नागरिक",
  "Confidence Score": "विश्वास स्कोर",
  "Export Answer": "उत्तर निर्यात करें",
  "Key Evidence": "मुख्य साक्ष्य",
  "Evidence Map": "साक्ष्य मानचित्र",
  "Related Projects": "संबंधित परियोजनाएँ",
  "Timeline of Events": "घटनाओं की समय-रेखा",
  "How AI Reached This Answer": "AI इस उत्तर तक कैसे पहुँचा",
  "AI Recommendation": "AI सिफ़ारिश",
  "Filters": "फ़िल्टर",
  "Online": "ऑनलाइन",
  "All": "सभी",
  "Submitted Issues": "जमा मुद्दे",

  // Data Explorer
  "Refresh": "रीफ्रेश",
  "Run query": "क्वेरी चलाएँ",

  // Settings
  "Enterprise Administration": "एंटरप्राइज़ प्रशासन",
  "Language & Theme": "भाषा और थीम",
  "Light": "हल्का",
  "Dark": "गहरा",
  "System": "सिस्टम",

  // Page labels
  "Executive home": "कार्यकारी होम",
  "Demand hotspots": "माँग हॉटस्पॉट",
  "Grounded answers": "आधारित उत्तर",
  "AI prioritization": "AI प्राथमिकता",
  "Execution portfolio": "निष्पादन पोर्टफोलियो",
  "Official reporting": "आधिकारिक रिपोर्टिंग",
  "Administration": "प्रशासन",

  // Status
  "In review": "समीक्षा में",
  "Shortlisted": "शॉर्टलिस्टेड",
  "Approved": "स्वीकृत",
  "Awaiting decision": "निर्णय की प्रतीक्षा",

  // Tour
  "Back": "वापस",
  "Finish": "समाप्त",
  "Next": "अगला",
  "Solution tour": "समाधान भ्रमण",
};

const webDictionaries: Record<string, UiDictionary> = {
  hindi: webHindi
};

/** Return the web console seed dictionary for a language. */
export function seedWebUiTranslations(language: string): UiDictionary | null {
  return webDictionaries[language.trim().toLowerCase()] ?? null;
}
