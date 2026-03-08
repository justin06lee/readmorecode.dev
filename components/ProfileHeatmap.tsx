"use client";

import { useMemo } from "react";
import type { HeatmapDay } from "@/lib/types";

interface ProfileHeatmapProps {
  data: HeatmapDay[];
}

function levelForCount(count: number): string {
  if (count <= 0) return "bg-zinc-200 dark:bg-zinc-800";
  if (count === 1) return "bg-emerald-200 dark:bg-emerald-900/40";
  if (count <= 3) return "bg-emerald-300 dark:bg-emerald-700/50";
  if (count <= 6) return "bg-emerald-500 dark:bg-emerald-500/70";
  return "bg-emerald-700 dark:bg-emerald-400";
}

export function ProfileHeatmap({ data }: ProfileHeatmapProps) {
  const weeks = useMemo(() => {
    const columns: HeatmapDay[][] = [];
    for (let i = 0; i < data.length; i += 7) {
      columns.push(data.slice(i, i + 7));
    }
    return columns;
  }, [data]);

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex gap-1 rounded-2xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/70">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-1">
            {week.map((day) => (
              <div
                key={day.date}
                className={`h-3.5 w-3.5 rounded-[4px] ${levelForCount(day.count)}`}
                title={`${day.date}: ${day.count} puzzle${day.count === 1 ? "" : "s"}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
