import { useEffect, useRef, useState } from "react";
import { Mic, Square, X, RotateCcw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function getSpeechConstructor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const ctor = w["SpeechRecognition"] ?? w["webkitSpeechRecognition"];
  return typeof ctor === "function" ? (ctor as new () => SpeechRecognitionLike) : null;
}

export function VoiceInput({
  onTranscript,
  defaultLang = "hi-IN",
  compact = false,
}: {
  onTranscript: (text: string) => void;
  defaultLang?: "hi-IN" | "en-IN";
  compact?: boolean;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [lang, setLang] = useState<"hi-IN" | "en-IN">(defaultLang);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const [lastTranscript, setLastTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    setSupported(getSpeechConstructor() !== null);
    return () => {
      try {
        if (recognitionRef.current) {
          recognitionRef.current.onend = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onstart = null;
          recognitionRef.current.abort();
        }
      } catch {
        /* ignore cleanup errors */
      }
    };
  }, []);

  function startRecording() {
    setError("");
    setInterim("");
    const Ctor = getSpeechConstructor();
    if (!Ctor) {
      setSupported(false);
      setError("Speech recognition is not supported in this browser. Type your query instead.");
      return;
    }
    try {
      recognitionRef.current?.abort();
    } catch {
      /* ignore */
    }
    cancelledRef.current = false;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    let finalChunk = "";
    rec.onstart = () => setListening(true);
    rec.onresult = (event) => {
      let live = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        if (!item) continue;
        const text = item[0]?.transcript ?? "";
        if (item.isFinal) finalChunk += text;
        else live += text;
      }
      setInterim((finalChunk + live).trim());
    };
    rec.onerror = (e) => {
      setListening(false);
      if (cancelledRef.current) return;
      cancelledRef.current = true;
      const code = e.error ?? "unknown";
      if (code === "not-allowed" || code === "service-not-allowed") {
        setError("Microphone permission was denied. Allow microphone access or type your query.");
      } else if (code === "no-speech") {
        setError("No speech detected. Try speaking closer to the microphone or retry.");
      } else if (code === "network") {
        setError("Browser speech service was unreachable. Type your query as a fallback.");
      } else if (code !== "aborted") {
        setError(`Speech recognition stopped (${code}). You can retry or type your query.`);
      }
    };
    rec.onend = () => {
      setListening(false);
      if (!cancelledRef.current) {
        const spoken = finalChunk.trim();
        if (spoken) {
          setLastTranscript(spoken);
          onTranscript(spoken);
        }
      }
      setInterim("");
    };
    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      setListening(false);
      setError("Could not start microphone recording. Check browser permissions.");
    }
  }

  function stopRecording() {
    try {
      recognitionRef.current?.stop();
    } catch {
      setListening(false);
    }
  }

  function cancelRecording() {
    cancelledRef.current = true;
    setInterim("");
    setListening(false);
    try {
      recognitionRef.current?.abort();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="voice-bar">
      <div className="flex flex-wrap items-center gap-2">
        <div className="voice-lang" role="group" aria-label="Speech recognition language">
          <button
            type="button"
            className={lang === "hi-IN" ? "active" : ""}
            disabled={listening}
            onClick={() => setLang("hi-IN")}
          >
            हिन्दी (hi-IN)
          </button>
          <button
            type="button"
            className={lang === "en-IN" ? "active" : ""}
            disabled={listening}
            onClick={() => setLang("en-IN")}
          >
            English / Hinglish (en-IN)
          </button>
        </div>
        {!listening ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={supported === false}
            onClick={startRecording}
            aria-label="Start voice input"
          >
            <Mic size={14} className="text-cyan" />
            {compact ? "Voice" : "Speak query"}
          </Button>
        ) : (
          <>
            <Button type="button" size="sm" variant="destructive" onClick={stopRecording}>
              <Square size={12} />
              Stop
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={cancelRecording}>
              <X size={13} />
              Cancel
            </Button>
          </>
        )}
        {!listening && lastTranscript && (
          <Button type="button" size="sm" variant="ghost" onClick={startRecording}>
            <RotateCcw size={12} />
            Retry
          </Button>
        )}
      </div>
      {listening && (
        <div className="voice-listening" role="status" aria-live="polite">
          <span className="voice-pulse" aria-hidden="true" />
          <span>
            Listening ({lang === "hi-IN" ? "Hindi" : "Indian English / Hinglish"})…
            {interim ? ` “${interim}”` : " Speak clearly, then review the text before predicting."}
          </span>
        </div>
      )}
      {supported === false && (
        <p className="text-[11px] text-warning mt-2">
          Web Speech API is unavailable in this browser. Normal text input remains fully active.
        </p>
      )}
      {error && (
        <p className="text-[11px] text-destructive mt-2" role="alert">
          {error}
        </p>
      )}
      {(
        <p className="flex items-start gap-1.5 text-[10px] text-muted-foreground mt-2">
          <Info size={12} className="shrink-0 mt-0.5" />
          Speech recognition uses your browser&apos;s Web Speech API and may depend on an external
          browser speech service. Review transcribed text before classifying with HingRoBERTa-Mixed.
        </p>
      )}
    </div>
  );
}