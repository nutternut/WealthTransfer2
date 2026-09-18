"use client";

type MintRangeProps = {
  min?: number;
  max?: number;
  value: number;
  onChange: (value: number) => void;
  "aria-label"?: string;
  className?: string;
};

export function MintRange({
  min = 0,
  max = 100,
  value,
  onChange,
  "aria-label": ariaLabel,
  className = "",
}: MintRangeProps) {
  const clamped = Math.min(max, Math.max(min, value));
  const fill = max > min ? ((clamped - min) / (max - min)) * 100 : 0;

  return (
    <div className={`relative flex h-5 items-center ${className}`}>
      <div
        className="pointer-events-none absolute inset-x-0 h-2 overflow-hidden rounded-full bg-mint-brandLight/70"
        aria-hidden
      >
        <div
          className="h-full rounded-full bg-linear-to-r from-mint-brand to-mint-brandDark transition-[width] duration-200 ease-out"
          style={{ width: `${fill}%` }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={clamped}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={clamped}
        className="mint-range"
        style={{ ["--fill" as string]: `${fill}%` }}
      />
    </div>
  );
}
