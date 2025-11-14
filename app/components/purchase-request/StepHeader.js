"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";


export default function StepHeader({
  title,
  subtitle,
  step,
  totalSteps,
  onBack
}) {
  return (
    <div className="mb-6">
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 mb-2"
        onClick={onBack}
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <h1 className="text-2xl font-bold">{title}</h1>

      {step !== undefined && totalSteps !== undefined && (
        <p className="text-muted-foreground">Step {step} of {totalSteps}</p>
      )}

      {subtitle && (
        <p className="text-muted-foreground mt-1">{subtitle}</p>
      )}
    </div>
  );
}
