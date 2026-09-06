import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw } from "lucide-react";

type Props = {
  onCapture: (dataUrl: string) => void;
  busy?: boolean;
  captureLabel?: string;
};

export function FaceCamera({ onCapture, busy = false, captureLabel = "Capture" }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setReady(true);
    } catch {
      setReady(false);
      setError("Camera access was blocked. Allow the camera and try again.");
    }
  }, []);

  useEffect(() => {
    void start();
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [start]);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const size = Math.min(video.videoWidth, video.videoHeight) || 480;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      video,
      (video.videoWidth - size) / 2,
      (video.videoHeight - size) / 2,
      size,
      size,
      0,
      0,
      size,
      size,
    );
    onCapture(canvas.toDataURL("image/jpeg", 0.85));
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative aspect-square w-full max-w-xs overflow-hidden rounded-3xl border border-border surface-scan">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full scale-x-[-1] object-cover"
        />
        <div className="pointer-events-none absolute inset-6 rounded-[2rem] border-2 border-primary/60" />
        {ready && !busy && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 animate-scanline bg-primary/25" />
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm font-medium text-primary">
            Checking your face…
          </div>
        )}
      </div>

      {error ? (
        <div className="text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => void start()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Try again
          </Button>
        </div>
      ) : (
        <Button
          size="lg"
          className="w-full max-w-xs rounded-full"
          disabled={!ready || busy}
          onClick={capture}
        >
          <Camera className="mr-2 h-5 w-5" />
          {captureLabel}
        </Button>
      )}
    </div>
  );
}
