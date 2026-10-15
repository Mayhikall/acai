"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, FolderKanban } from "lucide-react";
import { PageHeader, styles } from "./workspace-ui";

const WORKSPACE_KEY = "acai:last-workspace";

export default function DashboardPage() {
  const router = useRouter();
  useEffect(() => {
    const last = localStorage.getItem(WORKSPACE_KEY);
    if (last === "creator" || last === "clipper") {
      router.replace(`/dashboard/${last}`);
    }
  }, [router]);

  const choose = (workspace: "clipper" | "creator") => {
    localStorage.setItem(WORKSPACE_KEY, workspace);
    router.push(`/dashboard/${workspace}`);
  };
  return (
    <>
      <PageHeader
        title="Choose workspace"
        description="You can switch at any time. This choice is contextual and does not restrict your account."
      />
      <div className={styles.grid2}>
        <button
          className={styles.campaignCard}
          type="button"
          onClick={() => choose("clipper")}
        >
          <Clapperboard size={26} />
          <h2>Clipper</h2>
          <p>
            Discover campaigns, submit videos, track review progress, and claim
            rewards.
          </p>
        </button>
        <button
          className={styles.campaignCard}
          type="button"
          onClick={() => choose("creator")}
        >
          <FolderKanban size={26} />
          <h2>Creator</h2>
          <p>
            Create and fund campaigns, then review incoming clipper submissions.
          </p>
        </button>
      </div>
    </>
  );
}
