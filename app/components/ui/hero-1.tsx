"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, Building2, UserRound } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { FluidParticlesBackground } from "@/app/components/ui/fluid-particles-background";

export type Audience = "creator" | "brand";

interface HeroProps {
  title: ReactNode;
  subtitle: ReactNode;
  ctaLabel?: string;
  ctaHref?: string;
  paused?: boolean;
  onGetStarted?: (audience: Audience) => void;
}

export function Hero({
  title,
  subtitle,
  ctaLabel = "Get Started",
  ctaHref = "#contact",
  paused = false,
  onGetStarted,
}: HeroProps) {
  const [audience, setAudience] = useState<Audience>("creator");

  return (
    <section id="hero" aria-labelledby="hero-title">
      <FluidParticlesBackground className="creator-hero" paused={paused}>
        <div className="creator-hero-content">
          <h1 id="hero-title" className="creator-hero-title animate-fade-in">
            {title}
          </h1>
          <p className="creator-hero-description animate-fade-in">{subtitle}</p>
          <fieldset className="creator-audience">
            <legend className="sr-only">Choose your role</legend>
            {[
              { value: "brand", label: "I'm a Brand", icon: Building2 },
              { value: "creator", label: "I'm a Creator", icon: UserRound },
            ].map(({ value, label, icon: Icon }) => (
              <label key={value} className="creator-audience-option">
                <input
                  type="radio"
                  name="audience"
                  value={value}
                  checked={audience === value}
                  onChange={() => setAudience(value as Audience)}
                  className="sr-only"
                />
                <span>
                  <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                  {label}
                </span>
              </label>
            ))}
          </fieldset>
          {ctaLabel && onGetStarted ? (
            <Button
              className="creator-get-started"
              onClick={() => onGetStarted(audience)}
              aria-label={`${ctaLabel} as a ${audience}`}
            >
              {ctaLabel}
              <ArrowRight size={17} aria-hidden="true" />
            </Button>
          ) : ctaLabel ? (
            <Button asChild className="creator-get-started">
              <a href={ctaHref} aria-label={`${ctaLabel} as a ${audience}`}>
                {ctaLabel}
                <ArrowRight size={17} aria-hidden="true" />
              </a>
            </Button>
          ) : null}
        </div>
      </FluidParticlesBackground>
    </section>
  );
}
