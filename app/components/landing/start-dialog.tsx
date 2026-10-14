"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDownToLine, Check, X } from "lucide-react";
import type { Audience } from "@/app/components/ui/hero-1";

interface StartDialogProps {
  audience: Audience;
  category?: string;
  onClose: () => void;
}

export function StartDialog({
  audience,
  category = "",
  onClose,
}: StartDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const activeRef = useRef(false);
  const [file, setFile] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const isBrand = audience === "brand";

  useEffect(() => {
    activeRef.current = true;
    const opener = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      activeRef.current = false;
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, []);

  useEffect(() => {
    if (!file) return;
    downloadRef.current?.focus();
    return () => URL.revokeObjectURL(file);
  }, [file]);

  async function preparePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPreparing(true);
    setError("");
    try {
      const text = [
        isBrand ? "MY CAMPAIGN BRIEF" : "MY CREATOR PLAN",
        "",
        `Name: ${data.get("name")}`,
        `Content format: ${data.get("format")}`,
        `Category: ${data.get("category")}`,
        "",
        isBrand ? "Campaign direction" : "My content idea",
        String(data.get("idea")),
        "",
        isBrand ? "Campaign checklist" : "Clipping checklist",
        ...(isBrand
          ? [
              "[ ] Define the audience and campaign goal",
              "[ ] Confirm content rights and brand guidelines",
              "[ ] Set the budget, rate, and eligible view rules",
              "[ ] Agree on review and payment terms",
            ]
          : [
              "[ ] Read the campaign brief and eligible view rules",
              "[ ] Confirm permission to use the source content",
              "[ ] Edit a clear hook, captions, and call to action",
              "[ ] Save the published link and analytics",
            ]),
        "",
        "Prepared with the Acai landing-page planner. This file has not been submitted or sent to anyone.",
      ].join("\n");
      await new Promise<void>((resolve) => window.setTimeout(resolve, 350));
      if (!activeRef.current) return;
      setFile(
        URL.createObjectURL(
          new Blob([text], { type: "text/plain;charset=utf-8" })
        )
      );
    } catch {
      if (activeRef.current) {
        setError("Your file could not be prepared. Please try again.");
      }
    } finally {
      if (activeRef.current) setPreparing(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="start-dialog"
      aria-labelledby="start-dialog-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        className="dialog-close"
        onClick={onClose}
        aria-label="Close dialog"
      >
        <X size={22} />
      </button>
      <p className="section-kicker">
        {isBrand ? "For creators" : "For clippers"}
      </p>
      <h2 id="start-dialog-title">
        {isBrand
          ? "Give your campaign a starting point."
          : "Your next clip starts here."}
      </h2>
      {file ? (
        <div className="plan-ready" role="status">
          <span className="plan-ready-icon">
            <Check size={28} aria-hidden="true" />
          </span>
          <h3>
            {isBrand
              ? "Your campaign brief is ready."
              : "Your creator plan is ready."}
          </h3>
          <p>
            Download your notes and checklist. Nothing has been sent or
            submitted.
          </p>
          <a
            ref={downloadRef}
            className="action-button"
            href={file}
            download={
              isBrand ? "prism-campaign-brief.txt" : "prism-creator-plan.txt"
            }
          >
            Download your {isBrand ? "brief" : "plan"}
            <ArrowDownToLine size={18} aria-hidden="true" />
          </a>
          <button className="text-button" onClick={() => setFile(null)}>
            Create another {isBrand ? "brief" : "plan"}
          </button>
        </div>
      ) : (
        <>
          <p className="dialog-description">
            {isBrand
              ? "Put your campaign idea into a brief you can share with your team."
              : "Turn a content idea into a simple plan and clipping checklist."}{" "}
            This planner creates a downloadable file; it does not create an
            account.
          </p>
          <form onSubmit={preparePlan}>
            <label>
              Your name
              <input
                name="name"
                autoComplete="name"
                placeholder="Your name"
                required
                maxLength={100}
              />
            </label>
            <div className="dialog-fields">
              <label>
                Content format
                <select name="format" defaultValue="TikTok clip">
                  <option>TikTok clip</option>
                  <option>Instagram Reel</option>
                  <option>YouTube Short</option>
                </select>
              </label>
              <label>
                Category
                <select name="category" defaultValue={category || "Lifestyle"}>
                  <option>Lifestyle</option>
                  <option>Gaming</option>
                  <option>Film & culture</option>
                  <option>Tech</option>
                </select>
              </label>
            </div>
            <label>
              {isBrand ? "Your campaign idea" : "Your content idea"}
              <textarea
                name="idea"
                rows={3}
                placeholder={
                  isBrand
                    ? "Your audience, message, and what creators should make."
                    : "What will you clip, and what makes it worth watching?"
                }
                required
                maxLength={3000}
              />
            </label>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button
              className="action-button"
              type="submit"
              disabled={preparing}
            >
              {preparing
                ? "Preparing your file…"
                : isBrand
                  ? "Create my campaign brief"
                  : "Create my creator plan"}
            </button>
          </form>
        </>
      )}
    </dialog>
  );
}
