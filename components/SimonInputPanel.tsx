"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Loader2 } from "lucide-react";
import type { SimonInputs } from "@/lib/api";

interface Props {
  onRun:          (inputs: SimonInputs) => void;
  loading:        boolean;
  initialValues?: Partial<SimonInputs>;
}

function FieldLabel({ label, tooltip, error, htmlFor }: { label: string; tooltip: string; error?: boolean; htmlFor?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor} className={`text-xs font-medium ${error ? "text-red-500" : "text-az-graphite"}`}>
        {label}
      </Label>
      <Tooltip>
        <TooltipTrigger aria-label={`Info: ${label}`}>
          <Info className={`w-3 h-3 cursor-help ${error ? "text-red-400" : "text-az-platinum"}`} />
        </TooltipTrigger>
        <TooltipContent className="max-w-56 text-xs bg-az-graphite border-az-graphite text-white">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function SimonInputPanel({ onRun, loading, initialValues }: Props) {
  const [pu,        setPu]        = useState("0.30");
  const [pa,        setPa]        = useState("0.50");
  const [ep1,       setEp1]       = useState("0.05");
  const [nmax,      setNmax]      = useState("150");
  const [submitted, setSubmitted] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!initialValues) return;
    if (initialValues.pu   !== undefined) setPu(String(initialValues.pu));
    if (initialValues.pa   !== undefined) setPa(String(initialValues.pa));
    if (initialValues.ep1  !== undefined) setEp1(String(initialValues.ep1));
    if (initialValues.nmax !== undefined) setNmax(String(initialValues.nmax));
  }, [initialValues]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const invalidFields = useMemo((): Set<string> => {
    if (!submitted) return new Set();
    const s    = new Set<string>();
    const puV  = parseFloat(pu);
    const paV  = parseFloat(pa);
    const ep1V = parseFloat(ep1);
    const nmV  = parseInt(nmax, 10);

    if (isNaN(puV)  || puV  <= 0 || puV  >= 1)                s.add("pu");
    if (isNaN(paV)  || paV  <= 0 || paV  >= 1)                s.add("pa");
    if (!isNaN(puV) && !isNaN(paV) && paV <= puV)              s.add("pa");
    if (isNaN(ep1V) || ep1V < 0.01 || ep1V > 0.20)            s.add("ep1");
    if (isNaN(nmV)  || nmV  < 10   || nmV  > 1000)            s.add("nmax");
    return s;
  }, [submitted, pu, pa, ep1, nmax]);

  const handleRun = () => {
    setSubmitted(true);
    const puV  = parseFloat(pu);
    const paV  = parseFloat(pa);
    const ep1V = parseFloat(ep1);
    const nmV  = parseInt(nmax, 10);

    const valid =
      !isNaN(puV)  && puV  > 0 && puV < 1 &&
      !isNaN(paV)  && paV  > puV && paV < 1 &&
      !isNaN(ep1V) && ep1V >= 0.01 && ep1V <= 0.20 &&
      !isNaN(nmV)  && nmV  >= 10  && nmV  <= 1000;

    if (!valid) return;
    onRun({ pu: puV, pa: paV, ep1: ep1V, nmax: nmV });
  };

  const inputClass = "bg-white border-az-platinum text-az-graphite text-xs h-8 focus:border-az-mulberry focus:ring-az-mulberry/20 placeholder:text-az-platinum";
  const errorClass = "bg-red-50 border-red-400 text-az-graphite text-xs h-8 focus:border-red-400 focus:ring-red-100 placeholder:text-red-300";
  const ic = (name: string) => invalidFields.has(name) ? errorClass : inputClass;

  return (
    <Card className="bg-white border-az-light-platinum shadow-sm h-fit print-hidden">
      <CardHeader className="pb-3 border-b border-az-light-platinum">
        <CardTitle className="text-sm font-semibold text-az-navy" style={{ fontFamily: "var(--font-heading)" }}>
          Design Parameters
        </CardTitle>
        <p className="text-[10px] text-az-platinum mt-0.5">
          Phase 2 · Single-Arm · Binary Endpoint
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">

        <div className="space-y-1.5">
          <FieldLabel
            label="Unacceptable response rate (H₀)"
            tooltip="Response rate the drug must beat to be considered promising. Below this, the drug is unacceptable."
            error={invalidFields.has("pu")}
            htmlFor="simon-pu"
          />
          <Input
            id="simon-pu"
            value={pu}
            onChange={e => setPu(e.target.value)}
            className={ic("pu")}
            placeholder="0.30"
          />
        </div>

        <div className="space-y-1.5">
          <FieldLabel
            label="Target response rate (H₁)"
            tooltip="Response rate we want to detect with the specified power. Must be greater than the unacceptable rate."
            error={invalidFields.has("pa")}
            htmlFor="simon-pa"
          />
          <Input
            id="simon-pa"
            value={pa}
            onChange={e => setPa(e.target.value)}
            className={ic("pa")}
            placeholder="0.50"
          />
        </div>

        <div className="space-y-1.5">
          <FieldLabel
            label="Type I error (α)"
            tooltip="Maximum probability of declaring the drug promising when it isn't. Typical range: 0.05–0.10."
            error={invalidFields.has("ep1")}
            htmlFor="simon-ep1"
          />
          <Input
            id="simon-ep1"
            value={ep1}
            onChange={e => setEp1(e.target.value)}
            className={ic("ep1")}
            placeholder="0.05"
          />
        </div>

        <div className="space-y-1.5">
          <FieldLabel
            label="Max sample size"
            tooltip="Search limit for ph2simon. Increase if no feasible design is found at high power levels."
            error={invalidFields.has("nmax")}
            htmlFor="simon-nmax"
          />
          <Input
            id="simon-nmax"
            value={nmax}
            onChange={e => setNmax(e.target.value)}
            className={ic("nmax")}
            placeholder="150"
          />
        </div>

        <Button
          type="button"
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

        <p className="text-[10px] text-az-platinum text-center leading-relaxed pt-1">
          Sweeps 21 power levels (1%–99%) via{" "}
          <span className="font-mono">clinfun::ph2simon</span>.
          Optimal design minimises expected N under H₀.
        </p>
      </CardContent>
    </Card>
  );
}
