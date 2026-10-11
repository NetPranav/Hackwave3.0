"use client";

import { Fragment } from "react";
import Counter from "@/components/ui/Counter";
import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
  value: number;
  /** Font size in px. 44 for KPI numbers (same as /app), 11–14 for small header counts. */
  size?: number;
  /** Fixed decimal places, for example 2 for an error rate. */
  decimals?: number;
  /** Thousands separators: 1,420. */
  grouped?: boolean;
  weight?: number;
  className?: string;
}

/** Extra room around the digits so tall glyphs are not clipped: 4px at 44px, like /app. */
const padFor = (size: number) => Math.max(2, Math.round(size * 0.09));

function integerPlaces(digits: number): number[] {
  return Array.from({ length: digits }, (_, i) => 10 ** (digits - 1 - i));
}

/** Rolling odometer number, the same animation as the /app KPIs. Counts up on load and rolls when the value changes. */
export default function AnimatedNumber({
  value,
  size = 14,
  decimals = 0,
  grouped = false,
  weight,
  className,
}: AnimatedNumberProps) {
  const [intPart, decPart = ""] = Math.abs(value).toFixed(decimals).split(".");
  const groups = grouped ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",").split(",") : [intPart];
  const label = groups.join(grouped ? "," : "") + (decimals > 0 ? "." + decPart : "");
  const pad = padFor(size);

  return (
    <span className={cn("inline-flex items-end", className)}>
      <span className="sr-only">{label}</span>
      <span aria-hidden className="inline-flex items-end">
        {groups.map((group, i) => {
          const isLast = i === groups.length - 1;
          const withDecimals = isLast && decimals > 0;
          const places: (number | ".")[] = integerPlaces(group.length);
          if (withDecimals) {
            places.push(".", ...Array.from({ length: decimals }, (_, k) => 10 ** -(k + 1)));
          }
          return (
            <Fragment key={i}>
              {i > 0 && (
                <span
                  className="inline-flex items-center justify-center"
                  style={{ height: size + pad, fontSize: size, lineHeight: 1 }}
                >
                  ,
                </span>
              )}
              <Counter
                value={Number(withDecimals ? group + "." + decPart : group)}
                places={places}
                fontSize={size}
                padding={pad}
                gap={1}
                horizontalPadding={0}
                gradientHeight={0}
                textColor="inherit"
                fontWeight={weight ?? "inherit"}
              />
            </Fragment>
          );
        })}
      </span>
    </span>
  );
}
