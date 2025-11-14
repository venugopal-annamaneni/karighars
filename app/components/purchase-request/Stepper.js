"use client";


export default function Stepper({ current, steps }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: steps }).map((_, index) => {
        const step = index + 1;
        const isActive = step === current;
        const isCompleted = step < current;

        return (
          <div key={step} className="flex items-center gap-2">
            {/* Circle */}
            <div
              className={[
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isCompleted
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-200 text-gray-600"
              ].join(" ")}
            >
              {isCompleted ? "✓" : step}
            </div>

            {/* Connector (except last step) */}
            {step < steps && (
              <div className="w-10 h-0.5 bg-gray-300" />
            )}
          </div>
        );
      })}
    </div>
  );
}
