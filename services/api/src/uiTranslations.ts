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

/** Return the seed dictionary for a language, or null if none is hand-written. */
export function seedUiTranslations(language: string): UiDictionary | null {
  return dictionaries[language.trim().toLowerCase()] ?? null;
}
