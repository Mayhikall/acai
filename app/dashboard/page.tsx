import type { Metadata } from "next";
import { Dashboard } from "./dashboard";

export const metadata: Metadata = {
  title: "Dashboard | Acai",
  description:
    "Your Acai clipping workspace. Explore campaigns, organize submissions, and preview your performance.",
};

export default function DashboardPage() {
  return <Dashboard />;
}
