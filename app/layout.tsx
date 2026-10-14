import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "./components/providers";
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
  title: "Acai | Your next clip starts here",
  description:
    "Create, fund, and grow YouTube clip campaigns with one wallet on Acai.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={barlow.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
