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
      <Label className="text-az-graphite text-xs font-medium">{label}</Label>
      <Tooltip>
        <TooltipTrigger>
          <Info className="w-3 h-3 text-az-platinum cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="max-w-56 text-xs bg-az-graphite border-az-graphite text-white">
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

  const inputClass = "bg-white border-az-platinum text-az-graphite text-xs h-8 focus:border-az-mulberry focus:ring-az-mulberry/20 placeholder:text-az-platinum";

  return (
    <Card className="bg-white border-az-light-platinum shadow-sm h-fit">
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
              <FieldLabel label="Stages (k)" tooltip="Number of analyses including the final analysis. Default: 2 (one interim + one final)." />
              <Input value={k} onChange={(e) => setK(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel label="Alpha (α)" tooltip="One-sided Type I error rate. Common values: 0.025 (one-sided) or 0.05." />
              <Input value={alpha} onChange={(e) => setAlpha(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel label="Interim timing" tooltip="Information fraction at the interim analysis (0–1). E.g., 0.7 = 70% of total events." />
              <Input value={timing} onChange={(e) => setTiming(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel label="Dropout rate (η)" tooltip="Exponential dropout/loss-to-follow-up rate per time unit." />
              <Input value={eta} onChange={(e) => setEta(e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>

        <Separator className="bg-az-light-platinum" />

        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-az-platinum font-semibold">Survival Endpoint</p>
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
              <FieldLabel label="Min. follow-up (months)" tooltip="Minimum follow-up time after the last patient is enrolled, in months." />
              <Input value={minfup} onChange={(e) => setMinfup(e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>

        <Separator className="bg-az-light-platinum" />

        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-az-platinum font-semibold">Enrollment</p>
          <div className="space-y-1.5">
            <FieldLabel label="Enrollment rates (γ)" tooltip="Piecewise enrollment rates (patients/time unit), comma-separated." />
            <Input value={gamma} onChange={(e) => setGamma(e.target.value)} className={inputClass} placeholder="2.5, 5, 7.5, 10" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel label="Enrollment durations (R)" tooltip="Duration of each enrollment period, comma-separated. Must match the number of γ values." />
            <Input value={R} onChange={(e) => setR(e.target.value)} className={inputClass} placeholder="2, 2, 2, 12" />
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
              <SelectContent className="bg-white border-az-platinum">
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
              <SelectContent className="bg-white border-az-platinum">
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
      </CardContent>
    </Card>
  );
}
