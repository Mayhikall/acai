import { DashboardGate } from "./dashboard-gate";
import { WorkspaceShell } from "./workspace-shell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardGate>
      <WorkspaceShell>{children}</WorkspaceShell>
    </DashboardGate>
  );
}
