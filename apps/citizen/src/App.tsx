import {
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

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";
const accessTokenKey = "loksetuAccessToken";

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
  privacy: string;
};

const channels: Array<{ id: Channel; icon: typeof Camera; en: string; hi: string; hint: string }> = [
  { id: "photo", icon: Camera, en: "Take a photo", hi: "फ़ोटो खींचें", hint: "Pothole, garbage, broken tap" },
  { id: "voice", icon: Mic, en: "Speak", hi: "बोलकर बताएं", hint: "Record in any language" },
  { id: "text", icon: Type, en: "Type", hi: "लिखें", hint: "Write the problem" }
];

export default function App() {
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem(accessTokenKey) ?? "");
  const [step, setStep] = useState<Step>("choose");
  const [channel, setChannel] = useState<Channel>("photo");
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
  const [geo, setGeo] = useState<GeoState>({ status: "idle", label: "Detecting your area…" });

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (accessToken) detectLocation();
  }, [accessToken]);

  function detectLocation() {
    if (!("geolocation" in navigator)) {
      setGeo({ status: "denied", label: "Location required — enable browser location" });
      return;
    }
    setGeo({ status: "locating", label: "Detecting your area…" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeo({
          status: "ready",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: `Located near ${position.coords.latitude.toFixed(3)}, ${position.coords.longitude.toFixed(3)}`
        });
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
        area: geo.label
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

  function handleLogin(token: string) {
    localStorage.setItem(accessTokenKey, token);
    setAccessToken(token);
  }

  function logout() {
    localStorage.removeItem(accessTokenKey);
    setAccessToken("");
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
                <strong>Queued for processing</strong>
              </div>
              <div>
                <span>Area</span>
                <strong>{receipt.area}</strong>
              </div>
              <div>
                <span>Receipt ID</span>
                <strong className="score">{receipt.rawIntakeId.slice(0, 8)}</strong>
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
              </div>
            ) : null}
            <button className="submit" onClick={reset} type="button">
              Report another problem
            </button>
          </section>
        ) : null}
      </main>
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

function LoginPage({ onLogin }: { onLogin: (token: string) => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const payload = await response.json() as { token?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Login failed");
      onLogin(payload.token || "auth-disabled");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen auth-screen">
      <main className="auth-card">
        <span className="logo-mark">आ</span>
        <h1>Apni Awaaz Login</h1>
        <p>Access is restricted to control AI and cloud usage.</p>
        <form onSubmit={login}>
          <label>
            Password
            <input autoFocus onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
          </label>
          {error ? <p className="lookup-error">{error}</p> : null}
          <button className="submit" disabled={busy || !password.trim()} type="submit">
            {busy ? <Loader2 className="spin" size={18} /> : <ShieldCheck size={18} />}
            Login
          </button>
        </form>
      </main>
    </div>
  );
}
