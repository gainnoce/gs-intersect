"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Loader2 } from "lucide-react";
import type { PairedInputs } from "@/lib/api";

interface Props {
  onRun:   (inputs: PairedInputs) => void;
  loading: boolean;
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

export function PairedInputPanel({ onRun, loading }: Props) {
  const [mu_D,      setMuD]      = useState("2");
  const [sigma,     setSigma]    = useState("3");
  const [alpha,     setAlpha]    = useState("0.05");
  const [n_min,     setNMin]     = useState("5");
  const [n_max,     setNMax]     = useState("60");
  const [submitted, setSubmitted] = useState(false);

  const validate = () => {
    const s = new Set<string>();
    const muV  = parseFloat(mu_D);
    const sigV = parseFloat(sigma);
    const alpV = parseFloat(alpha);
    const nmn  = parseInt(n_min);
    const nmx  = parseInt(n_max);
    if (isNaN(muV))                                   s.add("mu_D");
    if (isNaN(sigV) || sigV <= 0)                     s.add("sigma");
    if (isNaN(alpV) || alpV <= 0 || alpV >= 1)        s.add("alpha");
    if (isNaN(nmn)  || nmn < 2)                       s.add("n_min");
    if (isNaN(nmx)  || nmx > 500 || nmx <= nmn)       s.add("n_max");
    return s;
  };

  const invalidFields = submitted ? validate() : new Set<string>();
  const inputClass = "bg-white border-az-platinum text-az-graphite text-xs h-8 focus:border-az-mulberry focus:ring-az-mulberry/20 placeholder:text-az-platinum";
  const errorClass = "bg-red-50 border-red-400 text-az-graphite text-xs h-8 focus:border-red-400 focus:ring-red-100 placeholder:text-red-300";
  const ic = (name: string) => invalidFields.has(name) ? errorClass : inputClass;

  const handleRun = () => {
    setSubmitted(true);
    const inv = validate();
    if (inv.size > 0) return;
    onRun({
      mu_D:  parseFloat(mu_D),
      sigma: parseFloat(sigma),
      alpha: parseFloat(alpha),
      n_min: parseInt(n_min),
      n_max: parseInt(n_max),
    });
  };

  return (
    <Card className="bg-white border-az-light-platinum shadow-sm h-fit print-hidden">
      <CardHeader className="pb-3 border-b border-az-light-platinum">
        <CardTitle className="text-sm font-semibold text-az-navy" style={{ fontFamily: "var(--font-heading)" }}>
          Design Parameters
        </CardTitle>
        <p className="text-[10px] text-az-platinum mt-0.5">Single-Arm · Continuous Endpoint</p>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">

        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-az-platinum font-semibold">Effect Size</p>
          <div className="space-y-1.5">
            <FieldLabel label="Target mean change (μ_D)" tooltip="Target mean paired difference on the original outcome scale (e.g. DAS28 units). Can be negative." error={invalidFields.has("mu_D")} />
            <Input value={mu_D} onChange={e => setMuD(e.target.value)} className={ic("mu_D")} placeholder="2" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel label="Std deviation (σ)" tooltip="Standard deviation of the paired differences. Must be positive." error={invalidFields.has("sigma")} />
            <Input value={sigma} onChange={e => setSigma(e.target.value)} className={ic("sigma")} placeholder="3" />
          </div>
        </div>

        <Separator className="bg-az-light-platinum" />

        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-az-platinum font-semibold">Error & Sample Size</p>
          <div className="space-y-1.5">
            <FieldLabel label="Alpha (α)" tooltip="Two-sided Type I error rate." error={invalidFields.has("alpha")} />
            <Input value={alpha} onChange={e => setAlpha(e.target.value)} className={ic("alpha")} placeholder="0.05" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <FieldLabel label="Min N" tooltip="Minimum sample size to evaluate." error={invalidFields.has("n_min")} />
              <Input value={n_min} onChange={e => setNMin(e.target.value)} className={ic("n_min")} placeholder="5" />
            </div>
            <div className="space-y-1.5">
              <FieldLabel label="Max N" tooltip="Maximum sample size to evaluate. Max 500." error={invalidFields.has("n_max")} />
              <Input value={n_max} onChange={e => setNMax(e.target.value)} className={ic("n_max")} placeholder="60" />
            </div>
          </div>
        </div>

        <Button
          onClick={handleRun}
          disabled={loading}
          className="w-full bg-az-mulberry hover:bg-az-mulberry/90 text-white font-semibold gap-2 mt-2"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Computing…</>
          ) : (
            "Run Optimization"
          )}
        </Button>

        {submitted && invalidFields.size > 0 && (
          <p className="text-xs text-red-500 text-center pt-1">Please correct the highlighted fields above.</p>
        )}

        <p className="text-[10px] text-az-platinum text-center leading-relaxed pt-1">
          Cohen&#39;s d = μ_D / σ. Sweeps N from min to max using base R&#39;s{" "}
          <span className="font-mono">pnorm</span> / <span className="font-mono">pt</span>.
        </p>
      </CardContent>
    </Card>
  );
}
