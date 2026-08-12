/**
 * Audio Prompt — completer (student-facing, runs in the site renderer). A
 * standalone React component over the typed `AudioPromptDef`: no ProseMirror.
 * Owns its own response state (the recording) — contained to this block.
 *
 * The recorder uses the browser `MediaRecorder` API:
 *   • Record / Stop — captures mic audio into a blob, consuming one attempt.
 *   • Re-record     — available until `attempts` are used up.
 *   • Playback      — an <audio controls> when `allowPlayback`.
 *   • Upload        — pick an audio file instead, when `allowUpload` (doesn't
 *                     consume a recording attempt).
 *
 * All audio is held as an object URL (revoked on replace + unmount). Mic access
 * is requested only on the first Record, and only here (never in the builder).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Microphone, Stop, UploadSimple } from "@phosphor-icons/react";

import { useRenderBlocks } from "../shared/blockRenderer";
import type { CompleterProps } from "../types";
import type { AudioPromptDef } from "./serialize";

/** Encapsulates the MediaRecorder lifecycle. `start(onComplete)` resolves the
 *  recorded blob via the callback; `stop()` ends it. Tracks are always released
 *  (on stop + unmount) so the mic indicator clears. */
function useAudioRecorder() {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(
    async (onComplete: (blob: Blob) => void) => {
      setError(null);
      if (
        typeof MediaRecorder === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setError("Recording isn’t supported in this browser.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        chunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });
          releaseStream();
          setRecording(false);
          onComplete(blob);
        };
        recorderRef.current = recorder;
        recorder.start();
        setRecording(true);
      } catch {
        releaseStream();
        setError("Microphone access was blocked. Check your browser permissions.");
      }
    },
    [releaseStream],
  );

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  // Release the mic if the block unmounts mid-recording.
  useEffect(() => releaseStream, [releaseStream]);

  return { recording, error, start, stop };
}

export function AudioPromptCompleter({ def }: CompleterProps<AudioPromptDef>) {
  const { attempts, allowPlayback, allowUpload } = def;
  const renderBlocks = useRenderBlocks();
  const { recording, error, start, stop } = useAudioRecorder();

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  // Hold the current object URL in a ref too, so the unmount cleanup isn't a
  // stale closure over `audioUrl`.
  const audioUrlRef = useRef<string | null>(null);

  const setAudio = useCallback((url: string | null) => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = url;
    setAudioUrl(url);
  }, []);

  useEffect(
    () => () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    },
    [],
  );

  const attemptsLeft = Math.max(0, attempts - attemptsUsed);
  const canRecord = attemptsLeft > 0 && !recording;

  const record = () => {
    void start((blob) => {
      setAudio(URL.createObjectURL(blob));
      setAttemptsUsed((n) => n + 1);
    });
  };

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (file) setAudio(URL.createObjectURL(file));
  };

  return (
    <div className="pp-audio-prompt-completer">
      <div className="pp-audio-prompt-completer-prompt">
        {renderBlocks(def.prompt)}
      </div>

      <div className="pp-audio-prompt-recorder">
        {recording ? (
          <button
            type="button"
            className="pp-audio-prompt-btn -recording"
            onClick={stop}
          >
            <Stop size={16} weight="fill" /> Stop
          </button>
        ) : (
          <button
            type="button"
            className="pp-audio-prompt-btn"
            onClick={record}
            disabled={!canRecord}
            title={
              !canRecord && attemptsLeft === 0
                ? "No attempts left"
                : undefined
            }
          >
            <Microphone size={16} weight="fill" />
            {attemptsUsed === 0 ? "Record" : "Re-record"}
          </button>
        )}

        {allowUpload && !recording && (
          <label className="pp-audio-prompt-btn -upload">
            <UploadSimple size={16} /> Upload
            <input
              type="file"
              accept="audio/*"
              hidden
              onChange={onUpload}
            />
          </label>
        )}

        {recording && (
          <span className="pp-audio-prompt-status" role="status">
            <span className="pp-audio-prompt-dot" aria-hidden /> Recording…
          </span>
        )}
        {attempts > 1 && !recording && (
          <span className="pp-audio-prompt-attempts">
            {attemptsLeft} attempt{attemptsLeft === 1 ? "" : "s"} left
          </span>
        )}
      </div>

      {error && <p className="pp-audio-prompt-error">{error}</p>}

      {audioUrl &&
        (allowPlayback ? (
          <audio className="pp-audio-prompt-player" src={audioUrl} controls />
        ) : (
          <p className="pp-audio-prompt-saved">Recording saved.</p>
        ))}
    </div>
  );
}
