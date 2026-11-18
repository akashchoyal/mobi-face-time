import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Loader2, ScanFace, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GroupCamera } from "./GroupCamera";
import {
  getGroupScanSetup,
  scanGroupAttendance,
  confirmGroupAttendance,
} from "@/lib/group-attendance.functions";
import { SUBJECTS_10TH, PERIODS } from "@/lib/subjects";
import { runLiveScanCycle } from "@/lib/live-scan";

export function GroupAttendanceScanner() {
  const setup = useServerFn(getGroupScanSetup);
  const scan = useServerFn(scanGroupAttendance);
  const confirm = useServerFn(confirmGroupAttendance);
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["group-scan-setup"],
    queryFn: () => setup(),
  });
  const [classKey, setClassKey] = useState("");
  const [subject, setSubject] = useState("");
  const [period, setPeriod] = useState("");
  const [camera, setCamera] = useState(false);
  const [photo, setPhoto] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof scan>> | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [saved, setSaved] = useState<number | null>(null);
  const liveActive = useRef(false);
  const [live, setLive] = useState(false);
  const [liveSaved, setLiveSaved] = useState(0);
  const [liveNames, setLiveNames] = useState<string[]>([]);
  const changeLive = useCallback((active: boolean) => {
    liveActive.current = active;
    setLive(active);
  }, []);
  useEffect(() => () => { liveActive.current = false; }, []);
  const classes = Array.from(
    new Map(
      (data?.students ?? [])
        .filter((s) => s.className && s.section && s.school)
        .map((s) => [
          JSON.stringify([s.school, s.className, s.section]),
          { school: s.school, className: s.className, section: s.section },
        ]),
    ).entries(),
  );
  const chosen = classes.find(([key]) => key === classKey)?.[1];
  const students = (data?.students ?? []).filter(
    (s) =>
      chosen &&
      s.school === chosen.school &&
      s.className === chosen.className &&
      s.section === chosen.section,
  );
  const enrolled = students.filter((s) => s.enrolled).length;
  function reset() {
    changeLive(false);
    setLiveSaved(0);
    setLiveNames([]);
    setPhoto("");
    setResult(null);
    setSelected([]);
    setSaved(null);
    setCamera(false);
  }
  async function recognizeLive(image: string) {
    if (!chosen || (chosen.className !== "10th" && chosen.className !== "11th")) return;
    setBusy(true);
    try {
      await runLiveScanCycle(
        () => scan({ data: { ...chosen, className: chosen.className as "10th" | "11th", image, subject, period } }),
        () => liveActive.current,
        (r) => r.matches.map((m) => m.id),
        async (r, ids) => {
          const outcome = await confirm({ data: { scanId: r.scanId, studentIds: ids } });
          setLiveSaved((count) => count + outcome.saved);
          setLiveNames(r.matches.map((m) => m.name));
          await queryClient.invalidateQueries({ queryKey: ["teacher-attendance"] });
          await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        },
      );
    } catch (e) {
      changeLive(false);
      toast.error(e instanceof Error ? e.message : "Live scan nahi hua.");
      throw e;
    } finally { setBusy(false); }
  }
  async function recognize() {
    if (!chosen || (chosen.className !== "10th" && chosen.className !== "11th")) return;
    setBusy(true);
    try {
      const r = await scan({
        data: { ...chosen, className: chosen.className, image: photo, subject, period },
      });
      setResult(r);
      setSelected(r.matches.map((m) => m.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan nahi hua.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!result) return;
    setBusy(true);
    try {
      const r = await confirm({ data: { scanId: result.scanId, studentIds: selected } });
      setSaved(r.saved);
      toast.success(`${r.saved} students ki attendance save hui.`);
      await queryClient.invalidateQueries({ queryKey: ["teacher-attendance"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Attendance save nahi hui.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-6 border-y border-border py-5">
      <div className="flex items-center gap-2">
        <ScanFace className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">Class face attendance</h2>
        <span className="ml-auto text-xs text-muted-foreground">Max 70</span>
      </div>
      {isLoading ? (
        <Loader2 className="mt-4 h-5 w-5 animate-spin" />
      ) : error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          Class list load nahi hui.
        </p>
      ) : (
        <>
          <label htmlFor="scan-class" className="mt-4 block text-sm">
            School / class
          </label>
          <select
            id="scan-class"
            disabled={busy || live || Boolean(result)}
            value={classKey}
            onChange={(e) => {
              reset();
              setClassKey(e.target.value);
              setSubject("");
            }}
            className="mt-2 h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Class chunein</option>
            {classes.map(([key, c]) => (
              <option key={key} value={key}>
                {c.school} · {c.className} – {c.section}
              </option>
            ))}
          </select>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {chosen?.className === "10th" && (
              <div>
                <label htmlFor="scan-subject" className="text-sm">
                  Subject
                </label>
                <select
                  id="scan-subject"
                  value={subject}
                  disabled={busy || live || Boolean(result)}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">Subject chunein</option>
                  {SUBJECTS_10TH.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="scan-period" className="text-sm">
                Period
              </label>
              <select
                id="scan-period"
                value={period}
                disabled={busy || live || Boolean(result)}
                onChange={(e) => setPeriod(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Period chunein</option>
                {PERIODS.map((p) => (
                  <option key={p.label} value={p.label}>
                    {p.label} · {p.time}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {chosen && (
            <p className="mt-3 text-xs text-muted-foreground">
              {students.length} students · {enrolled} faces saved · {students.length - enrolled}{" "}
              faces pending
            </p>
          )}
          {!data?.configured && (
            <p role="status" className="mt-3 text-sm text-muted-foreground">
              Group face pehchaan abhi band hai — Python server ka address aur key nahi jude hain.
            </p>
          )}
          {!camera && !photo && (
            <Button
              className="mt-4 w-full"
              disabled={
                !chosen ||
                !period ||
                (chosen.className === "10th" && !subject) ||
                students.length > 70
              }
              onClick={() => setCamera(true)}
            >
              <Camera /> Teacher camera kholein
            </Button>
          )}
          {camera && (
            <GroupCamera
              onLiveFrame={recognizeLive}
              onLiveChange={changeLive}
              liveEnabled={Boolean(data?.configured && enrolled)}
              onClose={() => { changeLive(false); setCamera(false); }}
              onCapture={(p) => {
                setPhoto(p);
                setCamera(false);
              }}
            />
          )}
          {(live || liveSaved > 0) && (
            <div role="status" className="mt-3 text-sm">
              <p className="text-success">{liveSaved} nayi attendance saved</p>
              {liveNames.length > 0 && <ul className="mt-2 max-h-48 overflow-y-auto">{liveNames.map((name, index) => <li key={index} className="break-words py-1">{name}</li>)}</ul>}
            </div>
          )}
          {photo && (
            <img
              src={photo}
              alt="Teacher ki class photo"
              className="mt-4 aspect-video w-full rounded-lg border border-border object-contain bg-muted"
            />
          )}
          {photo && !result && (
            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  reset();
                  setCamera(true);
                }}
              >
                <RefreshCw /> Nayi photo
              </Button>
              <Button
                className="flex-1"
                disabled={busy || !data?.configured || !enrolled}
                onClick={() => void recognize()}
              >
                {busy ? <Loader2 className="animate-spin" /> : <ScanFace />}
                {busy ? "Faces check ho rahe hain…" : "Students scan karein"}
              </Button>
            </div>
          )}
          {result && saved === null && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold">
                {result.matches.length} pehchaane · {result.detectedFaces} faces mile
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {Math.max(0, students.length - result.matches.length)} students ki pehchaan nahi hui
              </p>
              <ul className="mt-3 max-h-72 overflow-y-auto divide-y divide-border">
                {result.matches.map((m) => (
                  <li key={m.id}>
                    <label className="flex items-center gap-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(m.id)}
                        onChange={(e) =>
                          setSelected((ids) =>
                            e.target.checked ? [...ids, m.id] : ids.filter((id) => id !== m.id),
                          )
                        }
                        disabled={busy}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="min-w-0 flex-1 break-words text-sm">{m.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(m.confidence * 100)}%
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {!result.matches.length && (
                <p className="my-3 text-sm">
                  Koi student nahi pehchaana gaya. Saaf aur nazdeek se photo lein.
                </p>
              )}
              <Button
                className="mt-3 w-full"
                disabled={busy || !selected.length}
                onClick={() => void save()}
              >
                {busy ? <Loader2 className="animate-spin" /> : <Check />} Confirm ·{" "}
                {selected.length} attendance save karein
              </Button>
              <Button variant="ghost" className="mt-2 w-full" disabled={busy} onClick={reset}>
                Scan cancel karein
              </Button>
            </div>
          )}
          {saved !== null && (
            <div role="status" className="mt-4">
              <p className="text-sm text-success">
                {saved} attendance saved · pehle se present students dobara save nahi hue.
              </p>
              <Button variant="outline" className="mt-3" onClick={reset}>
                <RefreshCw /> Agli class
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
