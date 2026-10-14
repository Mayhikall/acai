"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  Clapperboard,
  Coins,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  PlusCircle,
  Settings,
  Video,
  X,
} from "lucide-react";
import { AcaiLogo } from "../components/acai-logo";
import { useAuth } from "../lib/auth/context";
import { shortAddress } from "../lib/format";
import styles from "./workspace.module.css";

const clipperNav = [
  ["/dashboard/clipper", "Overview", LayoutDashboard],
  ["/dashboard/clipper/campaigns", "Explore campaigns", Clapperboard],
  ["/dashboard/clipper/submissions", "My submissions", Video],
  ["/dashboard/clipper/earnings", "Earnings & claims", Coins],
] as const;
const creatorNav = [
  ["/dashboard/creator", "Overview", LayoutDashboard],
  ["/dashboard/creator/campaigns", "My campaigns", FolderKanban],
  ["/dashboard/creator/reviews", "Review queue", Video],
  ["/dashboard/creator/campaigns/new", "Create campaign", PlusCircle],
] as const;

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const workspace = pathname.startsWith("/dashboard/creator")
    ? "creator"
    : "clipper";
  const nav = workspace === "creator" ? creatorNav : clipperNav;
  const isActive = (href: string) =>
    pathname === href ||
    (href !== `/dashboard/${workspace}` && pathname.startsWith(`${href}/`));
  return (
    <div className={styles.shell}>
      {open && (
        <button
          className={styles.mobileBackdrop}
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={styles.sidebar} data-open={open}>
        <div className={styles.brand}>
          <Link href="/">
            <AcaiLogo />
          </Link>
        </div>
        <div className={styles.switcher} aria-label="Select workspace">
          <Link
            href="/dashboard/clipper"
            data-active={workspace === "clipper"}
            onClick={() =>
              localStorage.setItem("acai:last-workspace", "clipper")
            }
          >
            Clipper
          </Link>
          <Link
            href="/dashboard/creator"
            data-active={workspace === "creator"}
            onClick={() =>
              localStorage.setItem("acai:last-workspace", "creator")
            }
          >
            Creator
          </Link>
        </div>
        <nav className={styles.nav} aria-label={`${workspace} navigation`}>
          <span className={styles.navLabel}>
            {workspace === "creator" ? "Manage campaigns" : "Clip & earn"}
          </span>
          {nav.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              data-active={isActive(href)}
              onClick={() => setOpen(false)}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
          <span className={styles.navLabel}>Shared</span>
          <Link
            href="/dashboard/notifications"
            data-active={pathname === "/dashboard/notifications"}
          >
            <Bell size={18} />
            Notifications
          </Link>
          <Link
            href="/dashboard/settings/wallet"
            data-active={pathname.startsWith("/dashboard/settings")}
          >
            <Settings size={18} />
            Settings
          </Link>
        </nav>
        <div className={styles.sideFooter}>
          <span className={styles.network}>Solana Devnet</span>
          <div className={styles.account}>
            <span>{shortAddress(session?.wallet)}</span>
            <button type="button" title="Logout" onClick={() => void logout()}>
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className={styles.main}>
        <header className={styles.topbar}>
          <button
            className={styles.menuButton}
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={19} /> : <Menu size={19} />}
          </button>
          <strong>
            {workspace === "creator"
              ? "Creator · Manage campaigns"
              : "Clipper workspace"}
          </strong>
          <div className={styles.topActions}>
            <Link
              className={styles.iconButton}
              href="/dashboard/notifications"
              aria-label="Notifications"
            >
              <Bell size={18} />
            </Link>
          </div>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
