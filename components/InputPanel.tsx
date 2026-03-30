"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Loader2 } from "lucide-react";
import type { DesignInputs } from "@/lib/api";

const SPENDING_FUNCTIONS = [
  { value: "sfLDOF", label: "O'Brien-Fleming (OBF)" },
  { value: "sfLDPocock", label: "Pocock" },
  { value: "sfHSD", label: "Hwang-Shih-DeCani" },
];

const TIMING_DEFAULTS: Record<number, string> = {
  2: "0.7",
  3: "0.5, 0.8",
  4: "0.4, 0.65, 0.85",
};

interface Props {
  onRun: (inputs: DesignInputs) => void;
  loading: boolean;
  initialValues?: Partial<DesignInputs>;
}

function FieldLabel({ label, tooltip, error }: { label: string; tooltip: string; error?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className={`text-xs font-medium ${error ? "text-red-500" : "text-az-graphite"}`}>{label}</Label>
      <Tooltip>
        <TooltipTrigger>
          <Info className={`w-3 h-3 cursor-help ${error ? "text-red-400" : "text-az-platinum"}`} />
        </TooltipTrigger>
        <TooltipContent className="max-w-56 text-xs bg-az-graphite border-az-graphite text-white">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function InputPanel({ onRun, loading, initialValues }: Props) {
  const [k,        setK]       = useState("2");
  const [alpha,    setAlpha]   = useState("0.05");
  const [submitted, setSubmitted] = useState(false);
  const [timing, setTiming] = useState("0.7");
  const [hr,     setHr]     = useState("0.7");
  const [medianC, setMedianC] = useState("12");
  const [eta,    setEta]    = useState("0.05");
  const [minfup, setMinfup] = useState("24");
  const [gamma,  setGamma]  = useState("2.5, 5, 7.5, 10");
  const [R,      setR]      = useState("2, 2, 2, 12");
  const [sfu,    setSfu]    = useState("sfLDOF");
  const [sfl,    setSfl]    = useState("sfLDOF");

  // Seed state from initialValues (URL params on mount)
  useEffect(() => {
    if (!initialValues) return;
    if (initialValues.k       !== undefined) setK(String(initialValues.k));
    if (initialValues.alpha   !== undefined) setAlpha(String(initialValues.alpha));
    if (initialValues.timing  !== undefined) setTiming(initialValues.timing.join(", "));
    if (initialValues.hr      !== undefined) setHr(String(initialValues.hr));
    if (initialValues.medianC !== undefined) setMedianC(String(initialValues.medianC));
    if (initialValues.eta     !== undefined) setEta(String(initialValues.eta));
    if (initialValues.minfup  !== undefined) setMinfup(String(initialValues.minfup));
    if (initialValues.gamma   !== undefined) setGamma(initialValues.gamma.join(", "));
    if (initialValues.R       !== undefined) setR(initialValues.R.join(", "));
    if (initialValues.sfu     !== undefined) setSfu(initialValues.sfu);
    if (initialValues.sfl     !== undefined) setSfl(initialValues.sfl);
  }, [initialValues]);

  const parseArr = (s: string) =>
    s.split(",").map((v) => parseFloat(v.trim())).filter((n) => !isNaN(n));

  const kNum = parseInt(k) || 2;
  const timingPlaceholder = TIMING_DEFAULTS[kNum] ?? "0.7";

  // ── Validation ────────────────────────────────────────────────────────
  const getInvalidFields = (): Set<string> => {
    if (!submitted) return new Set();
    const s   = new Set<string>();
    const ta  = parseArr(timing);
    const ga  = parseArr(gamma);
    const ra  = parseArr(R);
    const alp = parseFloat(alpha);
    const hrv = parseFloat(hr);
    const med = parseFloat(medianC);
    const etv = parseFloat(eta);
    const mfp = parseFloat(minfup);

    if (isNaN(alp) || alp <= 0 || alp >= 1)                                  s.add("alpha");
    if (ta.length !== kNum - 1 ||
        ta.some(v => v <= 0 || v >= 1) ||
        ta.some((v, i) => i > 0 && v <= ta[i - 1]))                           s.add("timing");
    if (isNaN(hrv) || hrv <= 0 || hrv >= 1)                                   s.add("hr");
    if (isNaN(med) || med <= 0)                                                s.add("medianC");
    if (isNaN(etv) || etv < 0)                                                 s.add("eta");
    if (isNaN(mfp) || mfp <= 0)                                                s.add("minfup");
    if (ga.length === 0 || ga.some(v => v <= 0))                               s.add("gamma");
    if (ra.length === 0 || ra.length !== ga.length || ra.some(v => v <= 0))   s.add("R");
    return s;
  };

  const invalidFields = getInvalidFields();

  const handleRun = () => {
    setSubmitted(true);
    const ta = parseArr(timing);
    const ga = parseArr(gamma);
    const ra = parseArr(R);
    const alp = parseFloat(alpha);
    const hrv = parseFloat(hr);
    const med = parseFloat(medianC);
    const etv = parseFloat(eta);
    const mfp = parseFloat(minfup);

    const valid = (
      !isNaN(alp) && alp > 0 && alp < 1 &&
      ta.length === kNum - 1 && ta.every(v => v > 0 && v < 1) &&
      ta.every((v, i) => i === 0 || v > ta[i - 1]) &&
      !isNaN(hrv) && hrv > 0 && hrv < 1 &&
      !isNaN(med) && med > 0 &&
      !isNaN(etv) && etv >= 0 &&
      !isNaN(mfp) && mfp > 0 &&
      ga.length > 0 && ga.every(v => v > 0) &&
      ra.length > 0 && ra.length === ga.length && ra.every(v => v > 0)
    );
    if (!valid) return;

    onRun({ k: kNum, alpha: alp, timing: ta, hr: hrv, medianC: med, eta: etv, minfup: mfp, gamma: ga, R: ra, sfu, sfl });
  };

  const inputClass  = "bg-white border-az-platinum text-az-graphite text-xs h-8 focus:border-az-mulberry focus:ring-az-mulberry/20 placeholder:text-az-platinum";
  const errorClass  = "bg-red-50 border-red-400 text-az-graphite text-xs h-8 focus:border-red-400 focus:ring-red-100 placeholder:text-red-300";
  const ic = (name: string) => invalidFields.has(name) ? errorClass : inputClass;

  return (
    <Card className="bg-white border-az-light-platinum shadow-sm h-fit print-hidden">
      <CardHeader className="pb-3 border-b border-az-light-platinum">
        <CardTitle className="text-sm font-semibold text-az-navy" style={{ fontFamily: "var(--font-heading)" }}>
          Design Parameters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">

        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-az-platinum font-semibold">Trial Design</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <FieldLabel label="Stages (k)" tooltip="Number of analyses (1 interim + 1 final = 2, etc.). Maximum 4 stages." />
              <Select value={k} onValueChange={v => { if (v) { setK(v); setTiming(TIMING_DEFAULTS[parseInt(v)] ?? "0.7"); } }}>
                <SelectTrigger className={inputClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-az-platinum">
                  {["2", "3", "4"].map(v => (
                    <SelectItem key={v} value={v} className="text-az-graphite text-xs focus:bg-az-light-platinum">
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel label="Alpha (α)" tooltip="One-sided Type I error rate. Common values: 0.025 (one-sided) or 0.05." error={invalidFields.has("alpha")} />
              <Input value={alpha} onChange={(e) => setAlpha(e.target.value)} className={ic("alpha")} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <FieldLabel
                label={kNum === 2 ? "Interim timing" : `Interim timings (${kNum - 1} values)`}
                tooltip="Information fraction(s) at each interim analysis (0–1), comma-separated. Must be strictly increasing. E.g., 0.5, 0.8 for k=3."
                error={invalidFields.has("timing")}
              />
              <Input
                value={timing}
                onChange={(e) => setTiming(e.target.value)}
                className={ic("timing")}
                placeholder={timingPlaceholder}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel label="Dropout rate (η)" tooltip="Exponential dropout/loss-to-follow-up rate per time unit." error={invalidFields.has("eta")} />
              <Input value={eta} onChange={(e) => setEta(e.target.value)} className={ic("eta")} />
            </div>
          </div>
        </div>

        <Separator className="bg-az-light-platinum" />

        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-az-platinum font-semibold">Survival Endpoint</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <FieldLabel label="Median survival" tooltip="Median survival time in the control arm, in months." error={invalidFields.has("medianC")} />
              <Input value={medianC} onChange={(e) => setMedianC(e.target.value)} className={ic("medianC")} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel label="Target HR" tooltip="Target hazard ratio (experimental vs. control). Values below 1 favour the experimental arm." error={invalidFields.has("hr")} />
              <Input value={hr} onChange={(e) => setHr(e.target.value)} className={ic("hr")} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <FieldLabel label="Min. follow-up (months)" tooltip="Minimum follow-up time after the last patient is enrolled, in months." error={invalidFields.has("minfup")} />
              <Input value={minfup} onChange={(e) => setMinfup(e.target.value)} className={ic("minfup")} />
            </div>
          </div>
        </div>

        <Separator className="bg-az-light-platinum" />

        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-az-platinum font-semibold">Enrollment</p>
          <div className="space-y-1.5">
            <FieldLabel label="Enrollment rates (γ)" tooltip="Piecewise enrollment rates (patients/time unit), comma-separated." error={invalidFields.has("gamma")} />
            <Input value={gamma} onChange={(e) => setGamma(e.target.value)} className={ic("gamma")} placeholder="2.5, 5, 7.5, 10" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel label="Enrollment durations (R)" tooltip="Duration of each enrollment period, comma-separated. Must match the number of γ values." error={invalidFields.has("R")} />
            <Input value={R} onChange={(e) => setR(e.target.value)} className={ic("R")} placeholder="2, 2, 2, 12" />
          </div>
        </div>

        <Separator className="bg-az-light-platinum" />

        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-az-platinum font-semibold">Spending Functions</p>
          <div className="space-y-1.5">
            <FieldLabel label="Efficacy boundary" tooltip="Alpha-spending function for the efficacy (upper) boundary." />
            <Select value={sfu} onValueChange={(v) => v && setSfu(v)}>
              <SelectTrigger className={inputClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-az-platinum min-w-[220px]">
                {SPENDING_FUNCTIONS.map((f) => (
                  <SelectItem key={f.value} value={f.value} className="text-az-graphite text-xs focus:bg-az-light-platinum">
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <FieldLabel label="Futility boundary" tooltip="Alpha-spending function for the futility (lower) boundary." />
            <Select value={sfl} onValueChange={(v) => v && setSfl(v)}>
              <SelectTrigger className={inputClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-az-platinum min-w-[220px]">
                {SPENDING_FUNCTIONS.map((f) => (
                  <SelectItem key={f.value} value={f.value} className="text-az-graphite text-xs focus:bg-az-light-platinum">
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={handleRun}
          disabled={loading}
          className="w-full bg-az-mulberry hover:bg-az-mulberry/90 text-white font-semibold gap-2 mt-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Computing…
            </>
          ) : (
            "Run Optimization"
          )}
        </Button>
        {submitted && invalidFields.size > 0 && (
          <p className="text-xs text-red-500 text-center pt-1">
            Please correct the highlighted fields above.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
