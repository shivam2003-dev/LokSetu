import {
  Award,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Languages,
  Loader2,
  MapPin,
  Mic,
  Search,
  Send,
  ShieldCheck,
  Square,
  Type
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { detectLocalLanguage, nativeLanguageLabel } from "./localLanguage.js";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";
const accessTokenKey = "loksetuAccessToken";
const citizenIdentityKey = "loksetuCitizenIdentity";
const languagePrefKey = "loksetuLanguage";

type Channel = "photo" | "voice" | "text";
type Step = "choose" | "capture" | "sending" | "done";

type GeoState = {
  status: "idle" | "locating" | "ready" | "denied";
  lat?: number;
  lng?: number;
  label: string;
};

type Receipt = {
  message: string;
  rawIntakeId: string;
  status: string;
  nextStep: string;
  area: string;
  aadhaarMasked?: string;
  aadhaarVerified?: boolean;
};

type ReceiptLookup = {
  receiptId: string;
  status: string;
  nextStep: string;
  submittedAt: string;
  processedAt?: string;
  area: string;
  category?: string;
  ward?: string;
  district?: string;
  state?: string;
  mpId?: string;
  batchId?: string;
  aadhaarMasked?: string;
  aadhaarVerified?: boolean;
  identityMode?: string;
  citizenScore?: number;
  submissionQualityScore?: number;
  rewardPoints?: number;
  rewardBand?: string;
  rewardReasons?: string[];
  privacy: string;
};

type CitizenIdentity = {
  aadhaarMasked: string;
  aadhaarVerified: boolean;
  identityMode: string;
};

type RewardMilestone = {
  id: string;
  title: string;
  threshold: number;
  description: string;
};

type RewardLookup = {
  aadhaarMasked: string;
  aadhaarVerified: boolean;
  identityMode: string;
  totalRewardPoints: number;
  processedSubmissionCount: number;
  pendingSubmissionCount: number;
  failedSubmissionCount: number;
  averageQualityScore: number;
  excellentReports: number;
  strongReports: number;
  latestRewardedAt?: string;
  currentMilestone: RewardMilestone;
  nextMilestone?: RewardMilestone;
  pointsToNextMilestone: number;
  milestoneProgressPercent: number;
  recentRewards: Array<{
    receiptId: string;
    rewardPoints: number;
    rewardBand: string;
    qualityScore: number;
    category: string;
    area: string;
    processedAt: string;
  }>;
  privacy: string;
};

const channels: Array<{ id: Channel; icon: typeof Camera; en: string; hi: string; hint: string }> = [
  { id: "photo", icon: Camera, en: "Take a photo", hi: "फ़ोटो खींचें", hint: "Pothole, garbage, broken tap" },
  { id: "voice", icon: Mic, en: "Speak", hi: "बोलकर बताएं", hint: "Record in any language" },
  { id: "text", icon: Type, en: "Type", hi: "लिखें", hint: "Write the problem" }
];

const languageOptions = [
  "auto",
  "Hindi",
  "English",
  "Bangla",
  "Tamil",
  "Telugu",
  "Marathi",
  "Gujarati",
  "Kannada",
  "Malayalam",
  "Punjabi",
  "Odia",
  "Urdu",
  "Assamese",
  "Bodo",
  "Dogri",
  "Konkani",
  "Kashmiri",
  "Maithili",
  "Manipuri",
  "Nepali",
  "Sanskrit",
  "Santali",
  "Sindhi"
];

export default function App() {
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem(accessTokenKey) ?? "");
  const [citizenIdentity, setCitizenIdentity] = useState<CitizenIdentity | null>(() => readStoredCitizenIdentity());
  const [step, setStep] = useState<Step>("choose");
  const [channel, setChannel] = useState<Channel>("photo");
  const [language, setLanguage] = useState(() => localStorage.getItem(languagePrefKey) ?? "auto");
  const [localLanguage, setLocalLanguage] = useState<string | null>(null);
  const [languageModalOpen, setLanguageModalOpen] = useState(false);
  const [text, setText] = useState("");
  const [media, setMedia] = useState<string | null>(null);
  const [mediaName, setMediaName] = useState("");
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [receiptSearch, setReceiptSearch] = useState("");
  const [receiptLookup, setReceiptLookup] = useState<ReceiptLookup | null>(null);
  const [receiptLookupError, setReceiptLookupError] = useState("");
  const [receiptLookupBusy, setReceiptLookupBusy] = useState(false);
  const [rewardSummary, setRewardSummary] = useState<RewardLookup | null>(null);
  const [rewardSummaryError, setRewardSummaryError] = useState("");
  const [rewardSummaryBusy, setRewardSummaryBusy] = useState(false);
  const [rewardGuideOpen, setRewardGuideOpen] = useState(false);
  const [geo, setGeo] = useState<GeoState>({ status: "idle", label: "Detecting your area…" });

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (accessToken) detectLocation();
  }, [accessToken]);

  // Explicit citizen choice; persisted so it wins over location auto-detect on
  // the next visit.
  function chooseLanguage(next: string) {
    setLanguage(next);
    localStorage.setItem(languagePrefKey, next);
    setLanguageModalOpen(false);
  }

  function detectLocation() {
    if (!("geolocation" in navigator)) {
      setGeo({ status: "denied", label: "Location required — enable browser location" });
      return;
    }
    setGeo({ status: "locating", label: "Detecting your area…" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setGeo({
          status: "ready",
          lat: latitude,
          lng: longitude,
          label: `Located near ${latitude.toFixed(3)}, ${longitude.toFixed(3)}`
        });
        const detected = detectLocalLanguage(latitude, longitude);
        setLocalLanguage(detected);
        // Adopt the local language automatically only if the citizen has not
        // already picked one themselves.
        if (!localStorage.getItem(languagePrefKey)) setLanguage(detected);
      },
      () => setGeo({ status: "denied", label: "Location required — tap to allow access" }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function pickChannel(next: Channel) {
    setChannel(next);
    setStep("capture");
    setError("");
  }

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setMedia(String(reader.result));
      setMediaName(file.name);
    };
    reader.readAsDataURL(file);
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          setMedia(String(reader.result));
          setMediaName("Voice note recorded");
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError("Microphone permission needed to record.");
    }
  }

  const hasIssueContent = channel === "text" ? text.trim().length >= 4 : Boolean(media);
  const hasLocation = geo.status === "ready" && typeof geo.lat === "number" && typeof geo.lng === "number";
  const canSubmit = hasIssueContent && hasLocation;

  async function submit() {
    if (!hasIssueContent) {
      setError(channel === "text" ? "Please write the problem." : "Please add a photo or recording.");
      return;
    }
    if (!hasLocation) {
      setError("Location is required before submission. Tap Enable and allow location permission.");
      detectLocation();
      return;
    }
    setError("");
    setStep("sending");
    try {
      const response = await apiFetch("/api/citizen/submit", {
        method: "POST",
        body: JSON.stringify({
          channel,
          language: language === "auto" ? undefined : language,
          text: text.trim() || undefined,
          media: media || undefined,
          lat: geo.lat,
          lng: geo.lng,
          privacyMode: true
        })
      });
      if (response.status === 401) {
        logout();
        return;
      }
      if (!response.ok) throw new Error("submit failed");
      const payload = await response.json();
      setReceipt({
        message: payload.message,
        rawIntakeId: payload.rawIntakeId,
        status: payload.status,
        nextStep: payload.nextStep,
        area: geo.label,
        aadhaarMasked: payload.aadhaarMasked,
        aadhaarVerified: payload.aadhaarVerified
      });
      setReceiptSearch(payload.rawIntakeId.slice(0, 8));
      setStep("done");
    } catch {
      setError("Could not send. Please check your connection and try again.");
      setStep("capture");
    }
  }

  function reset() {
    setStep("choose");
    setText("");
    setMedia(null);
    setMediaName("");
    setReceipt(null);
    setError("");
  }

  async function searchReceipt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanReceipt = receiptSearch.trim();
    if (cleanReceipt.length < 8) {
      setReceiptLookupError("Enter the 8-character receipt ID.");
      setReceiptLookup(null);
      return;
    }
    setReceiptLookupBusy(true);
    setReceiptLookupError("");
    setReceiptLookup(null);
    try {
      const response = await apiFetch(`/api/citizen/receipts/${encodeURIComponent(cleanReceipt)}`);
      const payload = await response.json();
      if (response.status === 401) {
        logout();
        return;
      }
      if (!response.ok) throw new Error(payload.error ?? "Receipt lookup failed");
      setReceiptLookup(payload);
    } catch (lookupError) {
      setReceiptLookupError(lookupError instanceof Error ? lookupError.message : "Receipt lookup failed");
    } finally {
      setReceiptLookupBusy(false);
    }
  }

  function statusLabel(status: string) {
    return status.replace(/_/g, " ");
  }

  function handleLogin(token: string, identity: CitizenIdentity) {
    localStorage.setItem(accessTokenKey, token);
    localStorage.setItem(citizenIdentityKey, JSON.stringify(identity));
    setAccessToken(token);
    setCitizenIdentity(identity);
  }

  function logout() {
    localStorage.removeItem(accessTokenKey);
    localStorage.removeItem(citizenIdentityKey);
    setAccessToken("");
    setCitizenIdentity(null);
    setRewardSummary(null);
    setRewardSummaryError("");
  }

  async function loadMyRewards() {
    setRewardSummaryBusy(true);
    setRewardSummaryError("");
    try {
      const response = await apiFetch("/api/citizen/rewards/me");
      const payload = await response.json() as RewardLookup & { error?: string };
      if (response.status === 401) {
        logout();
        return;
      }
      if (!response.ok) throw new Error(payload.error ?? "Reward lookup failed");
      setRewardSummary(payload);
    } catch (lookupError) {
      setRewardSummaryError(lookupError instanceof Error ? lookupError.message : "Reward lookup failed");
    } finally {
      setRewardSummaryBusy(false);
    }
  }

  if (!accessToken) return <LoginPage onLogin={handleLogin} />;

  return (
    <div className="screen">
      <header className="appbar">
        <div className="logo">
          <span className="logo-mark">आ</span>
          <div>
            <strong>Apni Awaaz</strong>
            <small>Your voice reaches your MP</small>
          </div>
        </div>
        <button className="loc-chip" onClick={detectLocation} type="button">
          {geo.status === "locating" ? <Loader2 className="spin" size={15} /> : <MapPin size={15} />}
          <span>{geo.label}</span>
        </button>
        <button className="logout-chip" onClick={logout} type="button">Logout</button>
      </header>

      <main className="stage">
        {step === "choose" ? (
          <section className="choose">
            <h1>
              क्या समस्या है? <span>What is the problem?</span>
            </h1>
            <p className="lede">Report a local issue in seconds through the protected LokSetu intake.</p>
            <button className="reward-guide-button" onClick={() => setRewardGuideOpen(true)} type="button">
              <Award size={18} /> How to get 100% reward
            </button>
            <div className="tiles">
              {channels.map((item) => {
                const Icon = item.icon;
                return (
                  <button className="tile" key={item.id} onClick={() => pickChannel(item.id)} type="button">
                    <span className="tile-icon">
                      <Icon size={28} />
                    </span>
                    <strong>{item.hi}</strong>
                    <span className="tile-en">{item.en}</span>
                    <small>{item.hint}</small>
                  </button>
                );
              })}
            </div>
            <a
              className="whatsapp"
              href="https://wa.me/?text=I%20want%20to%20report%20a%20local%20problem"
              target="_blank"
              rel="noreferrer"
            >
              <Send size={18} /> Prefer WhatsApp? Send us a message
            </a>
            <p className="trust">
              <ShieldCheck size={15} /> Your name stays private. AI removes personal details before your MP sees it.
            </p>
            {citizenIdentity ? (
              <p className="identity-note">
                <ShieldCheck size={15} /> Aadhaar {citizenIdentity.aadhaarMasked} · format only
              </p>
            ) : null}
            <section className="reward-panel">
              <div className="reward-panel-head">
                <span>
                  <Award size={18} /> My reward total
                </span>
                <button disabled={rewardSummaryBusy} onClick={loadMyRewards} type="button">
                  {rewardSummaryBusy ? <Loader2 className="spin" size={16} /> : <Search size={16} />}
                  Show my reward total
                </button>
              </div>
              {rewardSummaryError ? <p className="lookup-error">{rewardSummaryError}</p> : null}
              {rewardSummary ? (
                <RewardSummaryCard reward={rewardSummary} />
              ) : (
                <p className="reward-empty">See cumulative reward points, milestone reached, and pending reports.</p>
              )}
            </section>
            <section className="track-card">
              <form className="track-form" onSubmit={searchReceipt}>
                <label>
                  Track receipt
                  <input
                    autoComplete="off"
                    inputMode="text"
                    onChange={(event) => setReceiptSearch(event.target.value)}
                    placeholder="fa4012a1"
                    value={receiptSearch}
                  />
                </label>
                <button disabled={receiptLookupBusy} type="submit">
                  {receiptLookupBusy ? <Loader2 className="spin" size={17} /> : <Search size={17} />}
                  Search
                </button>
              </form>
              {receiptLookupError ? <p className="lookup-error">{receiptLookupError}</p> : null}
              {receiptLookup ? (
                <div className="track-result">
                  <div>
                    <span>Status</span>
                    <strong>{statusLabel(receiptLookup.status)}</strong>
                  </div>
                  <div>
                    <span>Area</span>
                    <strong>{receiptLookup.area}</strong>
                  </div>
                  <p>{receiptLookup.nextStep}</p>
                  {receiptLookup.category ? <small>{receiptLookup.category} · {receiptLookup.ward}</small> : null}
                  {typeof receiptLookup.citizenScore === "number" ? (
                    <small>Reward {receiptLookup.citizenScore}/100 · quality {receiptLookup.submissionQualityScore ?? receiptLookup.citizenScore}/100</small>
                  ) : null}
                </div>
              ) : null}
            </section>
          </section>
        ) : null}

        {step === "capture" || step === "sending" ? (
          <section className="capture">
            <button className="back" onClick={() => setStep("choose")} type="button">
              <ArrowLeft size={18} /> Back
            </button>
            <button className="reward-guide-button compact" onClick={() => setRewardGuideOpen(true)} type="button">
              <Award size={17} /> 100% reward guide
            </button>

            <label className="note language-select">
              Language
              <select onChange={(event) => chooseLanguage(event.target.value)} value={language}>
                {languageOptions.map((item) => (
                  <option key={item} value={item}>
                    {item === "auto" ? "Auto-detect language" : item}
                  </option>
                ))}
              </select>
            </label>

            {channel === "photo" ? (
              <div className="block">
                <h2>Photo of the problem</h2>
                {media ? (
                  <img className="preview" src={media} alt="Selected problem" />
                ) : (
                  <label className="dropzone">
                    <Camera size={34} />
                    <strong>Tap to open camera</strong>
                    <small>or choose from gallery</small>
                    <input accept="image/*" capture="environment" hidden onChange={onFile} type="file" />
                  </label>
                )}
                {media ? (
                  <label className="retake">
                    Retake / choose another
                    <input accept="image/*" capture="environment" hidden onChange={onFile} type="file" />
                  </label>
                ) : null}
              </div>
            ) : null}

            {channel === "voice" ? (
              <div className="block">
                <h2>Record your voice</h2>
                <button className={`record ${recording ? "live" : ""}`} onClick={toggleRecording} type="button">
                  {recording ? <Square size={30} /> : <Mic size={34} />}
                  <strong>{recording ? "Tap to stop" : media ? "Record again" : "Tap to speak"}</strong>
                  <small>{recording ? "Listening…" : "Hindi, Tamil, Bangla, Marathi, English — any language"}</small>
                </button>
                {media && !recording ? (
                  <div className="voice-preview">
                    <p className="recorded"><CheckCircle2 size={16} /> {mediaName}</p>
                    <audio controls preload="metadata" src={media}>
                      Your browser does not support audio playback.
                    </audio>
                    <small>Listen once before submitting. Record again if needed.</small>
                  </div>
                ) : null}
              </div>
            ) : null}

            {channel === "text" ? (
              <div className="block">
                <h2>Describe the problem</h2>
                <textarea
                  autoFocus
                  onChange={(event) => setText(event.target.value)}
                  placeholder="E.g. School toilets are broken and classrooms flood after rain."
                  value={text}
                />
              </div>
            ) : null}

            {channel !== "text" ? (
              <label className="note">
                Add a note (optional)
                <input onChange={(event) => setText(event.target.value)} placeholder="Anything to add" value={text} />
              </label>
            ) : null}

            <div className="area-card">
              <MapPin size={16} />
              <div>
                <strong>{geo.status === "ready" ? "Auto-detected area" : "Location required"}</strong>
                <small>{geo.label}</small>
              </div>
              {geo.status !== "ready" ? (
                <button className="link" onClick={detectLocation} type="button">
                  Enable
                </button>
              ) : null}
            </div>

            {error ? <p className="error">{error}</p> : null}

            <button className="submit" disabled={!canSubmit || step === "sending"} onClick={submit} type="button">
              {step === "sending" ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
              {step === "sending" ? "Sending to your MP…" : hasLocation ? "Submit problem" : "Allow location to submit"}
            </button>
          </section>
        ) : null}

        {step === "done" && receipt ? (
          <section className="done">
            <div className="tick">
              <CheckCircle2 size={48} />
            </div>
            <h2>Submitted. Thank you!</h2>
            <p className="receipt-line">{receipt.message}</p>
            <div className="receipt-grid">
              <div>
                <span>Status</span>
                <strong>{receipt.status.replace("_", " ")}</strong>
              </div>
              <div>
                <span>
                  <Languages size={13} /> AI batch
                </span>
                <strong>Reward pending</strong>
              </div>
              <div>
                <span>Area</span>
                <strong>{receipt.area}</strong>
              </div>
              <div>
                <span>Receipt ID</span>
                <strong className="score">{receipt.rawIntakeId.slice(0, 8)}</strong>
              </div>
              <div>
                <span>Aadhaar</span>
                <strong>{receipt.aadhaarMasked ?? citizenIdentity?.aadhaarMasked ?? "format checked"}</strong>
              </div>
            </div>
            <form className="track-form done-track" onSubmit={searchReceipt}>
              <label>
                Search this receipt
                <input
                  autoComplete="off"
                  onChange={(event) => setReceiptSearch(event.target.value)}
                  value={receiptSearch}
                />
              </label>
              <button disabled={receiptLookupBusy} type="submit">
                {receiptLookupBusy ? <Loader2 className="spin" size={17} /> : <Search size={17} />}
                Search
              </button>
            </form>
            {receiptLookupError ? <p className="lookup-error">{receiptLookupError}</p> : null}
            {receiptLookup ? (
              <div className="track-result">
                <div>
                  <span>Status</span>
                  <strong>{statusLabel(receiptLookup.status)}</strong>
                </div>
                <div>
                  <span>Area</span>
                  <strong>{receiptLookup.area}</strong>
                </div>
                <p>{receiptLookup.nextStep}</p>
                {receiptLookup.category ? <small>{receiptLookup.category} · {receiptLookup.ward}</small> : null}
                {typeof receiptLookup.citizenScore === "number" ? (
                  <small>Reward {receiptLookup.citizenScore}/100 · quality {receiptLookup.submissionQualityScore ?? receiptLookup.citizenScore}/100</small>
                ) : null}
              </div>
            ) : null}
            <button className="submit" onClick={reset} type="button">
              Report another problem
            </button>
          </section>
        ) : null}
      </main>
      <LanguageBar
        language={language}
        localLanguage={localLanguage}
        onChoose={chooseLanguage}
        onMore={() => setLanguageModalOpen(true)}
      />
      {rewardGuideOpen ? <RewardGuide onClose={() => setRewardGuideOpen(false)} /> : null}
      {languageModalOpen ? (
        <LanguagePicker
          language={language}
          localLanguage={localLanguage}
          onChoose={chooseLanguage}
          onClose={() => setLanguageModalOpen(false)}
        />
      ) : null}
    </div>
  );
}

function LanguageBar({
  language,
  localLanguage,
  onChoose,
  onMore
}: {
  language: string;
  localLanguage: string | null;
  onChoose: (next: string) => void;
  onMore: () => void;
}) {
  // Facebook-style quick row: auto-detected local language first, then Hindi
  // and English, then a "More" button that opens the full list.
  const quick: string[] = [];
  if (localLanguage) quick.push(localLanguage);
  for (const item of ["Hindi", "English"]) {
    if (!quick.includes(item)) quick.push(item);
  }
  return (
    <footer className="language-bar" aria-label="Choose language">
      <span className="language-bar-label">
        <Languages size={14} /> Language
      </span>
      <div className="language-bar-options">
        {quick.map((item) => (
          <button
            key={item}
            className={`language-chip ${language === item ? "active" : ""}`}
            onClick={() => onChoose(item)}
            type="button"
          >
            {nativeLanguageLabel(item)}
            {item === localLanguage ? <em>local</em> : null}
          </button>
        ))}
        <button className="language-chip more" onClick={onMore} type="button">
          + More languages
        </button>
      </div>
    </footer>
  );
}

function LanguagePicker({
  language,
  localLanguage,
  onChoose,
  onClose
}: {
  language: string;
  localLanguage: string | null;
  onChoose: (next: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="guide-backdrop" role="dialog" aria-modal="true" aria-labelledby="language-picker-title" onClick={onClose}>
      <section className="language-picker" onClick={(event) => event.stopPropagation()}>
        <div className="guide-head">
          <span><Languages size={18} /> Choose your language</span>
          <button onClick={onClose} type="button">Close</button>
        </div>
        <h2 id="language-picker-title">Select a language</h2>
        <p>Pick any Indian language. Your voice or text can still be in any language — this sets your preference.</p>
        <div className="language-grid">
          {languageOptions.map((item) => (
            <button
              key={item}
              className={`language-option ${language === item ? "active" : ""}`}
              onClick={() => onChoose(item)}
              type="button"
            >
              <strong>{item === "auto" ? "Auto-detect" : nativeLanguageLabel(item)}</strong>
              <small>{item === "auto" ? "Detect from what you write or say" : item}</small>
              {item === localLanguage ? <span className="local-tag">Local</span> : null}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function RewardGuide({ onClose }: { onClose: () => void }) {
  return (
    <div className="guide-backdrop" role="dialog" aria-modal="true" aria-labelledby="reward-guide-title">
      <section className="reward-guide">
        <div className="guide-head">
          <span><Award size={18} /> Reward guide</span>
          <button onClick={onClose} type="button">Close</button>
        </div>
        <h2 id="reward-guide-title">How to report well and earn 100% reward</h2>
        <p>
          A 100% reward is for a clear, useful, public-interest report. Write in English, or translate these points
          into your own language before submitting.
        </p>
        <ol>
          <li>Give the exact place: road, lane, school, clinic, ward, landmark, or bus stop.</li>
          <li>Describe one public problem clearly. Keep private disputes and unrelated complaints out.</li>
          <li>Explain who is affected: children, patients, commuters, women, elderly people, or households.</li>
          <li>Add evidence when possible: photo, voice note, visible damage, timing, or how long it has continued.</li>
          <li>Explain urgency: safety risk, health risk, school disruption, water shortage, flooding, or night danger.</li>
          <li>Avoid abuse, rumors, duplicate spam, political slogans, and personal Aadhaar or phone details in the text.</li>
        </ol>
        <article>
          <strong>Good example</strong>
          <p>Streetlights near Kalindi Nagar bus stop have not worked for 10 days. Women and students feel unsafe after 7 PM, and there was one near-accident yesterday. Location is beside the main road tea stall.</p>
        </article>
      </section>
    </div>
  );
}

function RewardSummaryCard({ reward }: { reward: RewardLookup }) {
  const next = reward.nextMilestone;
  return (
    <div className="reward-summary" aria-live="polite">
      <div className="reward-total">
        <span>Cumulative reward</span>
        <strong>{reward.totalRewardPoints}</strong>
        <small>points till date</small>
      </div>
      <div className="milestone-box">
        <span>Current milestone</span>
        <strong>{reward.currentMilestone.title}</strong>
        <small>{reward.currentMilestone.description}</small>
      </div>
      <div className="milestone-progress">
        {next ? (
          <>
            <div>
              <span>Next milestone</span>
              <strong>{next.title}</strong>
            </div>
            <small>{reward.pointsToNextMilestone} points to go</small>
            <div className="progress-track">
              <span style={{ width: `${reward.milestoneProgressPercent}%` }} />
            </div>
          </>
        ) : (
          <strong>Top milestone reached</strong>
        )}
      </div>
      <div className="reward-stats">
        <span>{reward.processedSubmissionCount} processed</span>
        <span>{reward.pendingSubmissionCount} pending</span>
        <span>{reward.averageQualityScore}/100 average quality</span>
      </div>
      {reward.recentRewards.length ? (
        <ul className="recent-rewards">
          {reward.recentRewards.map((item) => (
            <li key={`${item.receiptId}-${item.processedAt}`}>
              <strong>{item.rewardPoints}/100</strong>
              <span>{item.category} · {item.rewardBand.replace("_", " ")}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="reward-empty">No processed rewards yet. Submitted reports appear here after AI batch scoring.</p>
      )}
      <p className="reward-privacy">{reward.privacy}</p>
    </div>
  );
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const token = localStorage.getItem(accessTokenKey) ?? "";
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${apiBase}${path}`, {
    ...init,
    headers
  });
}

function LoginPage({ onLogin }: { onLogin: (token: string, identity: CitizenIdentity) => void }) {
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [rewardLookupBusy, setRewardLookupBusy] = useState(false);
  const [rewardLookup, setRewardLookup] = useState<RewardLookup | null>(null);
  const [rewardLookupError, setRewardLookupError] = useState("");
  const [error, setError] = useState("");
  const aadhaarDigits = cleanAadhaar(aadhaarNumber);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (aadhaarDigits.length !== 12) {
      setError("Enter a 12-digit Aadhaar number.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${apiBase}/api/citizen/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aadhaarNumber: aadhaarDigits })
      });
      const payload = await response.json() as { token?: string; citizen?: CitizenIdentity; error?: string };
      if (!response.ok || !payload.token || !payload.citizen) throw new Error(payload.error ?? "Aadhaar access failed");
      onLogin(payload.token, payload.citizen);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Aadhaar access failed");
    } finally {
      setBusy(false);
    }
  }

  async function checkReward() {
    if (aadhaarDigits.length !== 12) {
      setRewardLookupError("Enter a 12-digit Aadhaar number.");
      return;
    }
    setRewardLookupBusy(true);
    setRewardLookupError("");
    try {
      const response = await fetch(`${apiBase}/api/citizen/rewards/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aadhaarNumber: aadhaarDigits })
      });
      const payload = await response.json() as RewardLookup & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Reward lookup failed");
      setRewardLookup(payload);
    } catch (lookupError) {
      setRewardLookupError(lookupError instanceof Error ? lookupError.message : "Reward lookup failed");
    } finally {
      setRewardLookupBusy(false);
    }
  }

  return (
    <div className="screen auth-screen">
      <main className="auth-card">
        <span className="logo-mark">आ</span>
        <h1>Apni Awaaz</h1>
        <p>Aadhaar access uses 12-digit format check only.</p>
        <form onSubmit={login}>
          <label>
            Aadhaar number
            <input
              autoComplete="off"
              autoFocus
              inputMode="numeric"
              maxLength={14}
              onChange={(event) => {
                setAadhaarNumber(formatAadhaar(event.target.value));
                setRewardLookup(null);
                setRewardLookupError("");
              }}
              placeholder="2345 6789 0123"
              type="text"
              value={aadhaarNumber}
            />
          </label>
          {error ? <p className="lookup-error">{error}</p> : null}
          <button className="submit" disabled={busy || aadhaarDigits.length !== 12} type="submit">
            {busy ? <Loader2 className="spin" size={18} /> : <ShieldCheck size={18} />}
            Continue
          </button>
          <button className="secondary-submit" disabled={rewardLookupBusy || aadhaarDigits.length !== 12} onClick={checkReward} type="button">
            {rewardLookupBusy ? <Loader2 className="spin" size={18} /> : <Award size={18} />}
            Check cumulative reward
          </button>
        </form>
        {rewardLookupError ? <p className="lookup-error">{rewardLookupError}</p> : null}
        {rewardLookup ? <RewardSummaryCard reward={rewardLookup} /> : null}
      </main>
    </div>
  );
}

function cleanAadhaar(value: string) {
  return value.replace(/\D/g, "").slice(0, 12);
}

function formatAadhaar(value: string) {
  return cleanAadhaar(value).replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function readStoredCitizenIdentity(): CitizenIdentity | null {
  try {
    const stored = localStorage.getItem(citizenIdentityKey);
    return stored ? JSON.parse(stored) as CitizenIdentity : null;
  } catch {
    return null;
  }
}
