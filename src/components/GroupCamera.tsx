import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GroupCamera({
  onCapture,
  onClose,
}: {
  onCapture: (image: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
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
  function capture() {
    const v = video.current;
    if (!v || !v.videoWidth || !v.videoHeight) return;
    const scale = Math.min(1, 3840 / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    onCapture(canvas.toDataURL("image/jpeg", 0.95));
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
          onClick={onClose}
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
        <Button className="flex-1" disabled={!ready} onClick={capture}>
          <Camera /> Class photo lein
        </Button>
        <Button
          variant="outline"
          size="icon"
          title={error ? "Dobara try karein" : "Camera badlein"}
          aria-label={error ? "Dobara try karein" : "Camera badlein"}
          onClick={() =>
            error
              ? setRetry((r) => r + 1)
              : setFacing((f) => (f === "user" ? "environment" : "user"))
          }
        >
          <RefreshCw />
        </Button>
      </div>
    </div>
  );
}
