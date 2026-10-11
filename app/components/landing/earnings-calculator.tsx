"use client";

import { useState, type CSSProperties } from "react";
import { TrendingUp } from "lucide-react";

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function EarningsCalculator() {
  const [views, setViews] = useState(250000);
  const [rate, setRate] = useState(5000);
  const estimate = (views / 1000) * rate;
  const progress = ((views - 10000) / (2000000 - 10000)) * 100;

  return (
    <div className="earnings-calculator">
      <div className="calculator-heading">
        <span>Content views</span>
        <output htmlFor="content-views">
          {new Intl.NumberFormat("en").format(views)}
        </output>
      </div>
      <input
        id="content-views"
        className="views-slider"
        type="range"
        min={10000}
        max={2000000}
        step={10000}
        value={views}
        onChange={(event) => setViews(Number(event.target.value))}
        aria-label="Content views"
        aria-valuetext={`${views.toLocaleString("en")} views`}
        style={{ "--range-progress": `${progress}%` } as CSSProperties}
      />
      <div className="slider-endpoints">
        <span>10K views</span>
        <span>2M views</span>
      </div>
      <label className="calculator-rate" htmlFor="sample-rate">
        Example rate per 1,000 views
        <select
          id="sample-rate"
          value={rate}
          onChange={(event) => setRate(Number(event.target.value))}
        >
          <option value={2500}>Rp 2.500</option>
          <option value={5000}>Rp 5.000</option>
          <option value={10000}>Rp 10.000</option>
        </select>
      </label>
      <div className="calculator-total">
        <div>
          <span>Estimated earnings</span>
          <output aria-live="polite">{rupiah.format(estimate)}</output>
        </div>
        <TrendingUp size={30} strokeWidth={1.6} aria-hidden="true" />
      </div>
      <p className="calculator-note">
        Illustrative calculation. Actual rates and eligible views depend on the
        campaign.
      </p>
    </div>
  );
}
