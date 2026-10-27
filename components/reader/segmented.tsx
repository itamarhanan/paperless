"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Option<T extends string> {
  value: T;
  label: ReactNode;
  /** Accessible name when the label is visual only. */
  ariaLabel?: string;
}

/** A segmented control built on native radio buttons. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  className?: string;
}) {
  const name = useId();
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="sr-only">{label}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "relative flex h-9 cursor-pointer select-none items-center justify-center rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors pointer-coarse:h-10",
              "has-[:checked]:bg-surface-raised has-[:checked]:text-foreground has-[:checked]:shadow-sm",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-ring"
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              aria-label={option.ariaLabel}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
