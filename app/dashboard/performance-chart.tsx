"use client";

import { useState } from "react";
import { compact, money, number } from "./data";
import styles from "./dashboard.module.css";

const dailyViews = [
  1200, 2300, 1800, 3400, 2600, 4100, 3200, 2700, 5100, 4300, 3800, 6200, 4700,
  5300, 3900, 7300, 6100, 5400, 7800, 6300, 8200, 7100, 6900, 8400, 11200, 9300,
  12600, 10800, 15400, 13100,
];

export function PerformanceChart({
  days,
  metric,
  onMetricChange,
}: {
  days: number;
  metric: "views" | "earnings";
  onMetricChange: (metric: "views" | "earnings") => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const values = dailyViews
    .slice(-days)
    .map((views) => (metric === "views" ? views : views * 0.003));
  const max =
    Math.ceil(Math.max(...values) / (metric === "views" ? 5000 : 15)) *
    (metric === "views" ? 5000 : 15);
  const points = values.map((value, index) => ({
    x: 4 + (index / (values.length - 1)) * 792,
    y: 195 - (value / max) * 165,
  }));
  const path = points
    .map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`)
    .join(" ");
  const active =
    hovered !== null && hovered < values.length ? hovered : values.length - 1;
  const dateFor = (index: number) =>
    new Date(Date.UTC(2026, 9, 14 - days + index)).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  const format = metric === "views" ? number : money;

  return (
    <>
      <div className={styles.chartSummary}>
        <div>
          <strong>
            {format(values.reduce((sum, value) => sum + value, 0))}
          </strong>
          <span>
            {metric === "views"
              ? "sample views"
              : "aUSDC · at an example $3 CPM"}
          </span>
        </div>
        <div className={styles.segmented} aria-label="Chart metric">
          <button
            aria-pressed={metric === "views"}
            onClick={() => onMetricChange("views")}
          >
            Views
          </button>
          <button
            aria-pressed={metric === "earnings"}
            onClick={() => onMetricChange("earnings")}
          >
            Earnings
          </button>
        </div>
      </div>
      <div className={styles.chartReadout} aria-live="polite">
        {dateFor(active)}{" "}
        <strong>
          {format(values[active])}
          {metric === "views" ? " views" : " aUSDC"}
        </strong>
      </div>
      <div className={styles.chartPlot}>
        <div className={styles.chartYAxis} aria-hidden="true">
          {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
            <span key={ratio}>
              {metric === "views" ? compact(max * ratio) : `$${max * ratio}`}
            </span>
          ))}
        </div>
        <svg
          viewBox="0 0 800 210"
          role="group"
          aria-label={`${metric === "views" ? "Views" : "Example earnings"} over the last ${days} days. All values are sample data.`}
        >
          <defs>
            <linearGradient id="acai-chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <line
              key={ratio}
              x1="0"
              x2="800"
              y1={195 - ratio * 165}
              y2={195 - ratio * 165}
              stroke="#303034"
              strokeDasharray="3 5"
            />
          ))}
          <path d={`${path} L796,200 L4,200 Z`} fill="url(#acai-chart-fill)" />
          <path
            d={path}
            fill="none"
            stroke="#b49aff"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <line
            x1={points[active].x}
            x2={points[active].x}
            y1="20"
            y2="200"
            stroke="#80758e"
            strokeDasharray="4 5"
          />
          {points.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={index === active ? 5 : 9}
              fill={index === active ? "#c4b1ff" : "transparent"}
              stroke={index === active ? "#18181b" : "none"}
              strokeWidth="3"
              tabIndex={0}
              role="img"
              aria-label={`${dateFor(index)}: ${format(values[index])} ${metric === "views" ? "views" : "aUSDC"}`}
              onMouseEnter={() => setHovered(index)}
              onFocus={() => setHovered(index)}
            />
          ))}
        </svg>
      </div>
      <div className={styles.chartXAxis} aria-hidden="true">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <span key={ratio}>{dateFor(Math.round((days - 1) * ratio))}</span>
        ))}
      </div>
      <p className={styles.chartNote}>
        Illustrative trend, separate from submission totals.
      </p>
    </>
  );
}
