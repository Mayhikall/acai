import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const barlow = localFont({
  src: [
    { path: "./_assets/barlow-regular.ttf", weight: "400", style: "normal" },
    { path: "./_assets/barlow-medium.ttf", weight: "500", style: "normal" },
  ],
  variable: "--font-barlow",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Prism | Your next clip starts here",
  description:
    "Explore the creator workflow, calculate example earnings, and plan your next clip or brand campaign with Prism.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={barlow.variable}>{children}</body>
    </html>
  );
}
