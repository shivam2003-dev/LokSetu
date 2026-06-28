import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Languages,
  Loader2,
  MapPin,
  Mic,
  Send,
  ShieldCheck,
  Square,
  Type
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";

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
  category: string;
  detectedLanguage: string;
  citizenScore: number;
  area: string;
};

const channels: Array<{ id: Channel; icon: typeof Camera; en: string; hi: string; hint: string }> = [
  { id: "photo", icon: Camera, en: "Take a photo", hi: "फ़ोटो खींचें", hint: "Pothole, garbage, broken tap" },
  { id: "voice", icon: Mic, en: "Speak", hi: "बोलकर बताएं", hint: "Record in any language" },
  { id: "text", icon: Type, en: "Type", hi: "लिखें", hint: "Write the problem" }
];

export default function App() {
  const [step, setStep] = useState<Step>("choose");
  const [channel, setChannel] = useState<Channel>("photo");
  const [text, setText] = useState("");
  const [media, setMedia] = useState<string | null>(null);
  const [mediaName, setMediaName] = useState("");
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [geo, setGeo] = useState<GeoState>({ status: "idle", label: "Detecting your area…" });

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    detectLocation();
  }, []);

  function detectLocation() {
    if (!("geolocation" in navigator)) {
      setGeo({ status: "denied", label: "Location off — your MP area will be set by staff" });
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
      () => setGeo({ status: "denied", label: "Location off — tap to enable for auto-routing" }),
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

  const canSubmit = channel === "text" ? text.trim().length >= 4 : Boolean(media);

  async function submit() {
    if (!canSubmit) {
      setError(channel === "text" ? "Please write the problem." : "Please add a photo or recording.");
      return;
    }
    setError("");
    setStep("sending");
    try {
      const response = await fetch(`${apiBase}/api/citizen/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          text: text.trim() || undefined,
          media: media || undefined,
          lat: geo.lat,
          lng: geo.lng,
          privacyMode: true
        })
      });
      if (!response.ok) throw new Error("submit failed");
      const payload = await response.json();
      setReceipt({
        message: payload.message,
        category: payload.submission.category,
        detectedLanguage: payload.submission.detectedLanguage,
        citizenScore: payload.citizenScore,
        area: payload.submission.locationLabel ?? payload.submission.ward
      });
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
      </header>

      <main className="stage">
        {step === "choose" ? (
          <section className="choose">
            <h1>
              क्या समस्या है? <span>What is the problem?</span>
            </h1>
            <p className="lede">Report a local issue in seconds. No form, no login.</p>
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
                {media && !recording ? <p className="recorded"><CheckCircle2 size={16} /> {mediaName}</p> : null}
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
                <strong>{geo.status === "ready" ? "Auto-detected area" : "Area"}</strong>
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
              {step === "sending" ? "Sending to your MP…" : "Submit problem"}
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
                <span>Category</span>
                <strong>{receipt.category}</strong>
              </div>
              <div>
                <span>
                  <Languages size={13} /> Language
                </span>
                <strong>{receipt.detectedLanguage}</strong>
              </div>
              <div>
                <span>Area</span>
                <strong>{receipt.area}</strong>
              </div>
              <div>
                <span>Your impact score</span>
                <strong className="score">{receipt.citizenScore}</strong>
              </div>
            </div>
            <button className="submit" onClick={reset} type="button">
              Report another problem
            </button>
          </section>
        ) : null}
      </main>
    </div>
  );
}
