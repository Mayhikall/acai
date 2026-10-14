import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./workspace.module.css";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

export function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link className={styles.button} href={href}>
      {children}
    </Link>
  );
}

export function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <article className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const tone = ["FUNDED", "ACCEPTED", "READY"].includes(normalized)
    ? "success"
    : [
          "PENDING_FUNDING",
          "PENDING_REVIEW",
          "PENDING",
          "AWAITING_SIGNATURE",
          "SUBMITTED",
          "INITIALIZED",
        ].includes(normalized)
      ? "warning"
      : ["REJECTED", "REJECTED_FINAL", "CLOSED"].includes(normalized)
        ? "danger"
        : "neutral";
  return (
    <span className={styles.badge} data-tone={tone}>
      {status.replaceAll("_", " ").toLowerCase()}
    </span>
  );
}

export function DataState({
  loading,
  error,
  empty,
  emptyText = "No data available.",
}: {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  emptyText?: string;
}) {
  if (loading)
    return (
      <div className={styles.state} aria-busy="true">
        Loading data…
      </div>
    );
  if (error)
    return (
      <div className={styles.state} role="alert">
        <strong>Unable to load data</strong>
        <span>
          {error instanceof Error
            ? error.message
            : "Please make sure the Acai backend is running."}
        </span>
      </div>
    );
  if (empty)
    return (
      <div className={styles.empty}>
        <strong>No activity yet</strong>
        <span>{emptyText}</span>
      </div>
    );
  return null;
}

export { styles };
