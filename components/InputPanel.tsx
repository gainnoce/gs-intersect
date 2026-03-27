"use client";

import { useState } from "react";
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

interface Props {
  onRun: (inputs: DesignInputs) => void;
  loading: boolean;
}

function FieldLabel({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className="text-zinc-300 text-xs">{label}</Label>
      <Tooltip>
        <TooltipTrigger>
          <Info className="w-3 h-3 text-zinc-600 cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="max-w-56 text-xs bg-zinc-800 border-zinc-700 text-zinc-300">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function InputPanel({ onRun, loading }: Props) {
  const [k, setK] = useState("2");
  const [alpha, setAlpha] = useState("0.05");
  const [timing, setTiming] = useState("0.7");
  const [hr, setHr] = useState("0.7");
  const [medianC, setMedianC] = useState("12");
  const [eta, setEta] = useState("0.05");
  const [minfup, setMinfup] = useState("24");
  const [gamma, setGamma] = useState("2.5, 5, 7.5, 10");
  const [R, setR] = useState("2, 2, 2, 12");
  const [sfu, setSfu] = useState("sfLDOF");
  const [sfl, setSfl] = useState("sfLDOF");

  const parseArr = (s: string) =>
    s.split(",").map((v) => parseFloat(v.trim())).filter((n) => !isNaN(n));

  const handleRun = () => {
    onRun({
      k: parseInt(k),
      alpha: parseFloat(alpha),
      timing: parseFloat(timing),
      hr: parseFloat(hr),
      medianC: parseFloat(medianC),
      eta: parseFloat(eta),
      minfup: parseFloat(minfup),
      gamma: parseArr(gamma),
      R: parseArr(R),
      sfu,
      sfl,
    });
  };

  const inputClass = "bg-zinc-900 border-zinc-700 text-zinc-100 text-xs h-8 focus:border-indigo-500 focus:ring-indigo-500/20";

  return (
    <Card className="bg-zinc-900/50 border-zinc-800 h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-zinc-200">Design Parameters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">

        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-medium">Trial Design</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <FieldLabel label="Stages (k)" tooltip="Number of analyses including the final analysis. Default: 2 (one interim + one final)." />
              <Input value={k} onChange={(e) => setK(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel label="Alpha (α)" tooltip="One-sided Type I error rate. Common values: 0.025 (one-sided) or 0.05 (two-sided divided by 2)." />
              <Input value={alpha} onChange={(e) => setAlpha(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel label="Interim timing" tooltip="Information fraction at the interim analysis (0–1). E.g., 0.7 means the interim occurs at 70% of total events." />
              <Input value={timing} onChange={(e) => setTiming(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel label="Dropout rate (η)" tooltip="Exponential dropout/loss-to-follow-up rate per time unit." />
              <Input value={eta} onChange={(e) => setEta(e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>

        <Separator className="bg-zinc-800" />

        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-medium">Survival Endpoint</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <FieldLabel label="Median survival (control)" tooltip="Median survival time in the control arm, in months." />
              <Input value={medianC} onChange={(e) => setMedianC(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel label="Target HR" tooltip="Target hazard ratio (experimental vs. control). Values below 1 favour the experimental arm." />
              <Input value={hr} onChange={(e) => setHr(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <FieldLabel label="Minimum follow-up (months)" tooltip="Minimum follow-up time after the last patient is enrolled, in months." />
              <Input value={minfup} onChange={(e) => setMinfup(e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>

        <Separator className="bg-zinc-800" />

        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-medium">Enrollment</p>
          <div className="space-y-1.5">
            <FieldLabel label="Enrollment rates (γ)" tooltip="Piecewise enrollment rates (patients/time unit), comma-separated. E.g., 2.5, 5, 7.5, 10" />
            <Input value={gamma} onChange={(e) => setGamma(e.target.value)} className={inputClass} placeholder="2.5, 5, 7.5, 10" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel label="Enrollment durations (R)" tooltip="Duration of each enrollment period, comma-separated. Must match the number of γ values." />
            <Input value={R} onChange={(e) => setR(e.target.value)} className={inputClass} placeholder="2, 2, 2, 12" />
          </div>
        </div>

        <Separator className="bg-zinc-800" />

        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-medium">Spending Functions</p>
          <div className="space-y-1.5">
            <FieldLabel label="Efficacy boundary" tooltip="Alpha-spending function for the efficacy (upper) boundary." />
            <Select value={sfu} onValueChange={(v) => v && setSfu(v)}>
              <SelectTrigger className={inputClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                {SPENDING_FUNCTIONS.map((f) => (
                  <SelectItem key={f.value} value={f.value} className="text-zinc-300 text-xs focus:bg-zinc-800">
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
              <SelectContent className="bg-zinc-900 border-zinc-700">
                {SPENDING_FUNCTIONS.map((f) => (
                  <SelectItem key={f.value} value={f.value} className="text-zinc-300 text-xs focus:bg-zinc-800">
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
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium gap-2 mt-2"
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
      </CardContent>
    </Card>
  );
}
