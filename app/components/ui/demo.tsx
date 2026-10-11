import { Hero } from "@/app/components/ui/hero-1";

export default function DemoOne() {
  return (
    <Hero
      title={
        <>
          Get paid to make
          <br />
          content, from
          <br />
          anywhere.
        </>
      }
      subtitle="100% free — the easiest, smoothest creator/clipping platform. Just post, get paid per view, and cash out the fastest, guaranteed."
      ctaLabel="Get Started"
      ctaHref="#contact"
    />
  );
}
