"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Loader2 } from "lucide-react";
import type { DiffProportionsInputs } from "@/lib/api";

interface Props {
  onRun:   (inputs: DiffProportionsInputs) => void;
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

export function DiffProportionsInputPanel({ onRun, loading }: Props) {
  const [p_soc,     setPSoc]     = useState("0.30");
  const [p_inv,     setPInv]     = useState("0.50");
  const [alpha,     setAlpha]    = useState("0.05");
  const [n_min,     setNMin]     = useState("20");
  const [n_max,     setNMax]     = useState("200");
  const [submitted, setSubmitted] = useState(false);

  const validate = () => {
    const s    = new Set<string>();
    const psV  = parseFloat(p_soc);
    const piV  = parseFloat(p_inv);
    const alpV = parseFloat(alpha);
    const nmn  = parseInt(n_min);
    const nmx  = parseInt(n_max);
    if (isNaN(psV) || psV <= 0 || psV >= 1)                           s.add("p_soc");
    if (isNaN(piV) || piV <= 0 || piV >= 1 || (!isNaN(psV) && piV <= psV)) s.add("p_inv");
    if (isNaN(alpV) || alpV <= 0 || alpV >= 1)                         s.add("alpha");
    if (isNaN(nmn)  || nmn < 2)                                        s.add("n_min");
    if (isNaN(nmx)  || nmx > 1000 || nmx <= nmn)                      s.add("n_max");
    return s;
  };

  const invalidFields = submitted ? validate() : new Set<string>();
  const inputClass = "bg-white border-az-platinum text-az-graphite text-xs h-8 focus:border-az-mulberry focus:ring-az-mulberry/20 placeholder:text-az-platinum";
  const errorClass = "bg-red-50 border-red-400 text-az-graphite text-xs h-8 focus:border-red-400 focus:ring-red-100 placeholder:text-red-300";
  const ic = (name: string) => invalidFields.has(name) ? errorClass : inputClass;

  const handleRun = () => {
    setSubmitted(true);
    if (validate().size > 0) return;
    onRun({
      p_soc: parseFloat(p_soc),
      p_inv: parseFloat(p_inv),
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
        <p className="text-[10px] text-az-platinum mt-0.5">Parallel 2-Arm · Gaussian Approximation</p>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">

        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-az-platinum font-semibold">Response Rates (H₁)</p>
          <div className="space-y-1.5">
            <FieldLabel label="SOC ORR (p_SOC)" tooltip="Expected ORR in the standard of care (control) arm under H₁. Must be between 0 and 1." error={invalidFields.has("p_soc")} />
            <Input value={p_soc} onChange={e => setPSoc(e.target.value)} className={ic("p_soc")} placeholder="0.30" />
          </div>
          <div className="space-y-1.5">
            <FieldLabel label="Investigational ORR (p_INV)" tooltip="Expected ORR in the investigational arm under H₁. Must exceed p_SOC." error={invalidFields.has("p_inv")} />
            <Input value={p_inv} onChange={e => setPInv(e.target.value)} className={ic("p_inv")} placeholder="0.50" />
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
              <FieldLabel label="Min N (per arm)" tooltip="Minimum sample size per arm to evaluate." error={invalidFields.has("n_min")} />
              <Input value={n_min} onChange={e => setNMin(e.target.value)} className={ic("n_min")} placeholder="20" />
            </div>
            <div className="space-y-1.5">
              <FieldLabel label="Max N (per arm)" tooltip="Maximum sample size per arm to evaluate. Max 1000." error={invalidFields.has("n_max")} />
              <Input value={n_max} onChange={e => setNMax(e.target.value)} className={ic("n_max")} placeholder="200" />
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
          Frequentist (Gaussian) only · Bayesian version in R supplementary script
        </p>
      </CardContent>
    </Card>
  );
}
