"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { buttonClass, inputClass } from "./ui";

// ---- Web Speech API(ブラウザの音声認識)の最小限の型 ----
interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  isFinal: boolean;
  0: RecognitionAlternative;
}
interface RecognitionEvent {
  resultIndex: number;
  results: { length: number; [index: number]: RecognitionResult };
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return candidates.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
}

function formatElapsed(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export type Recording = { blob: Blob; extension: string; seconds: number };

/**
 * 会議の録音と文字起こし。
 * - 録音: MediaRecorder で音声ファイルを作る(保存時にGoogleドライブへアップロード)
 * - 文字起こし: ブラウザの音声認識(Chrome / Edge / Safari)で、話した内容をリアルタイムにテキスト化
 */
export function MeetingRecorder({
  transcript,
  onTranscriptChange,
  recording,
  onRecording,
}: {
  transcript: string;
  onTranscriptChange: (text: string) => void;
  recording: Recording | null;
  onRecording: (r: Recording | null) => void;
}) {
  const [active, setActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  // このコンポーネントはクライアントでのみ描画される(StoreHydration が復元後に子を描画する)
  const [sttSupported] = useState(() => !!getRecognitionCtor());

  const transcriptRef = useRef(transcript);
  const activeRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // 録音の「端末に保存」用URL(録音が変わったら古いURLを解放する)
  const audioUrl = useMemo(() => (recording ? URL.createObjectURL(recording.blob) : null), [recording]);
  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      // 画面を離れたら録音を止める
      activeRef.current = false;
      recognitionRef.current?.stop();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function start() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("このブラウザは録音に対応していません。");
      return;
    }
    if (recording && !confirm("前の録音を破棄して新しく録音しますか?(文字起こしは残ります)")) return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("マイクを使用できません。ブラウザのマイクの許可を確認してください。");
      return;
    }
    streamRef.current = stream;
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      const type = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunks, { type });
      const extension = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
      onRecording({ blob, extension, seconds: Math.round((Date.now() - startedAtRef.current) / 1000) });
      stream.getTracks().forEach((t) => t.stop());
    };
    recorder.start(1000);
    recorderRef.current = recorder;

    const Ctor = getRecognitionCtor();
    if (Ctor) {
      const rec = new Ctor();
      rec.lang = "ja-JP";
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let pending = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) {
            const text = r[0].transcript.trim();
            if (text) {
              const prev = transcriptRef.current;
              const next = prev ? `${prev}\n${text}` : text;
              transcriptRef.current = next;
              onTranscriptChange(next);
            }
          } else {
            pending += r[0].transcript;
          }
        }
        setInterim(pending);
      };
      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setError("音声認識が許可されていません。録音のみ続けます。");
        }
      };
      // 無音が続くと認識が止まるため、録音中は自動で再開する
      rec.onend = () => {
        if (activeRef.current) {
          try {
            rec.start();
          } catch {
            /* すでに開始済み */
          }
        }
      };
      try {
        rec.start();
        recognitionRef.current = rec;
      } catch {
        setError("音声認識を開始できませんでした。録音のみ行います。");
      }
    }

    startedAtRef.current = Date.now();
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000)), 1000);
    activeRef.current = true;
    setActive(true);
  }

  function stop() {
    activeRef.current = false;
    setActive(false);
    setInterim("");
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
  }

  async function loadTextFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    onTranscriptChange(transcript ? `${transcript}\n${text}` : text);
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {active ? (
          <button type="button" onClick={stop} className={`${buttonClass.primary} bg-rose-600 hover:bg-rose-700`}>
            ■ 録音を停止
          </button>
        ) : (
          <button type="button" onClick={start} className={buttonClass.primary}>
            🎙 録音を開始
          </button>
        )}
        {active && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-rose-600">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" /> 録音中 {formatElapsed(elapsed)}
          </span>
        )}
        {!active && recording && (
          <span className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            ✓ 録音あり({formatElapsed(recording.seconds)})
            <a
              href={audioUrl ?? undefined}
              download={`録音.${recording.extension}`}
              className="font-semibold text-teal-700 hover:underline"
            >
              端末に保存
            </a>
            <button type="button" className="text-rose-600 hover:underline" onClick={() => confirm("録音を破棄しますか?") && onRecording(null)}>
              破棄
            </button>
          </span>
        )}
        <label className={`${buttonClass.ghost} ml-auto cursor-pointer`}>
          📄 テキストファイルを読み込む
          <input type="file" accept=".txt,.vtt,.srt,text/plain" className="hidden" onChange={loadTextFile} />
        </label>
      </div>
      {!sttSupported && (
        <p className="text-xs text-amber-700">
          このブラウザは文字起こしに対応していないため、録音のみ行います。文字起こしは Chrome(PC・Android)または Safari をお使いください。
        </p>
      )}
      {error && <p className="text-xs text-rose-600">⚠ {error}</p>}
      <div>
        <textarea
          className={`${inputClass} min-h-32 font-normal`}
          placeholder="録音すると、ここに文字起こしが自動で入ります。会議ツールの文字起こしを貼り付けることもできます。"
          value={transcript}
          onChange={(e) => onTranscriptChange(e.target.value)}
        />
        {interim && <p className="mt-1 text-xs italic text-slate-400">認識中: {interim}</p>}
      </div>
    </div>
  );
}
