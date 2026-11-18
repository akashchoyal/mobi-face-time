import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X, Play, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GroupCamera({
  onCapture,
  onClose,
  onLiveFrame,
  liveEnabled = false,
  onLiveChange,
}: {
  onCapture: (image: string) => void;
  onClose: () => void;
  onLiveFrame?: (image: string) => Promise<void>;
  liveEnabled?: boolean;
  onLiveChange?: (active: boolean) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [live, setLive] = useState(false);
  const running = useRef(false);
  const processing = useRef(false);
  const liveFrame = useRef(onLiveFrame);
  liveFrame.current = onLiveFrame;
  useEffect(() => {
    if (!live || !ready) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function next() {
      if (cancelled) return;
      if (!processing.current) {
        const image = captureImage();
        if (image && liveFrame.current) {
          processing.current = true;
          try { await liveFrame.current(image); }
          catch { running.current = false; setLive(false); onLiveChange?.(false); }
          finally { processing.current = false; }
        }
      }
      if (!cancelled && running.current) timer = setTimeout(() => void next(), 3000);
    }
    void next();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [live, ready, onLiveChange]);
  useEffect(() => () => { running.current = false; }, []);
  useEffect(() => {
    let active = true;
    setReady(false);
    setError("");
    void navigator.mediaDevices
      ?.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 3840 }, height: { ideal: 2160 } },
        audio: false,
      })
      .then(async (s) => {
        if (!active) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play();
        }
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) setError("Camera allow karein aur dobara try karein.");
      });
    if (!navigator.mediaDevices) setError("Is browser mein camera available nahi hai.");
    return () => {
      active = false;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
  }, [facing, retry]);
  function captureImage() {
    const v = video.current;
    if (!v || !v.videoWidth || !v.videoHeight) return;
    const scale = Math.min(1, 3840 / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.95);
  }
  return (
    <div className="mt-4 space-y-3">
      <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-muted">
        <video ref={video} muted playsInline className="h-full w-full object-contain" />
        <Button
          variant="secondary"
          size="icon"
          title="Camera band karein"
          aria-label="Camera band karein"
          onClick={() => { running.current = false; onLiveChange?.(false); onClose(); }}
          className="absolute right-2 top-2"
        >
          <X />
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button className="flex-1" disabled={!ready || live || processing.current} onClick={() => { const image = captureImage(); if (image) onCapture(image); }}>
          <Camera /> Class photo lein
        </Button>
        <Button
          variant="outline"
          size="icon"
          title={error ? "Dobara try karein" : "Camera badlein"}
          aria-label={error ? "Dobara try karein" : "Camera badlein"}
          disabled={live}
          onClick={() =>
            error
              ? setRetry((r) => r + 1)
              : setFacing((f) => (f === "user" ? "environment" : "user"))
          }
        >
          <RefreshCw />
        </Button>
      </div>
      {onLiveFrame && (
        <Button className="w-full" variant={live ? "destructive" : "default"}
          disabled={!ready || (!live && !liveEnabled)}
          onClick={() => { const active = !live; running.current = active; onLiveChange?.(active); setLive(active); }}>
          {live ? <Square /> : <Play />} {live ? "Live scan rokein" : "Live attendance shuru karein"}
        </Button>
      )}
      {live && <p role="status" className="flex items-center gap-2 text-sm text-primary"><Loader2 className="h-4 w-4 animate-spin" /> Live scan chal raha hai</p>}
    </div>
  );
}
