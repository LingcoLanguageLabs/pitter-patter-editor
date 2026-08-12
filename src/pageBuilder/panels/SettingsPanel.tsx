/**
 * Settings panel — site-wide options:
 *   • **Site name** — renames the active catalog entry (store `setSiteName`),
 *     reflected live in the site picker and the persisted catalog.
 *   • **Grading scope** — the level a "Check" button grades learning prompts at
 *     (prompt / section / page / whole activity). Prompts no longer carry their
 *     own Check button — this scope is what a button's "Check" action adopts, so
 *     the author drops a Check button at the matching level. Reads/writes the
 *     store's `gradingScope` (an authoring policy; the button records its own
 *     scope+target).
 *   • **Danger zone** — delete the active site (`deleteSite`). A two-step inline
 *     confirm (no native dialog); disabled when it's the only site. On confirm
 *     it returns to the menu so the picker shows the surviving site.
 */

"use client";

import { Trash } from "@phosphor-icons/react";
import { useState } from "react";

import { Field, Segmented } from "../blockSettings/forms";
import { GRADE_SCOPES, type GradeScope } from "../items/shared/grading";
import { navigateTo, usePageBuilderStore } from "../store";

const SCOPE_LABELS: Record<GradeScope, string> = {
  prompt: "Prompt",
  section: "Section",
  page: "Page",
  activity: "Activity",
};

export function SettingsPanel() {
  const sites = usePageBuilderStore((s) => s.sites);
  const activeSiteId = usePageBuilderStore((s) => s.activeSiteId);
  const setSiteName = usePageBuilderStore((s) => s.setSiteName);
  const deleteSite = usePageBuilderStore((s) => s.deleteSite);
  const gradingScope = usePageBuilderStore((s) => s.gradingScope);
  const setGradingScope = usePageBuilderStore((s) => s.setGradingScope);
  const siteName = sites.find((s) => s.id === activeSiteId)?.name ?? "";
  const isOnlySite = sites.length <= 1;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  return (
    <>
      <button
        type="button"
        className="pb-panel-back"
        onClick={() => navigateTo("menu")}
        aria-label="Back to menu"
      >
        ←
      </button>
      <div className="pb-panel-titlebar">
        <h1 className="pb-panel-title">Settings</h1>
      </div>

      <Field label="Site name">
        <input
          type="text"
          className="pb-text-input"
          value={siteName}
          onChange={(e) => setSiteName(e.target.value)}
        />
      </Field>

      <Field label="Grading scope">
        <Segmented<GradeScope>
          ariaLabel="Grading scope"
          value={gradingScope}
          options={GRADE_SCOPES.map((v) => ({ value: v, label: SCOPE_LABELS[v] }))}
          onChange={setGradingScope}
        />
      </Field>
      <p className="pb-panel-note">
        The level a “Check” button grades at. Prompts have no Check button of
        their own — add a button with the matching “Check {SCOPE_LABELS[
          gradingScope
        ].toLowerCase()}” action.
      </p>

      <div className="pb-danger-zone">
        <h2 className="pb-panel-section-title pb-danger-title">Danger zone</h2>
        <p className="pb-panel-note">
          Deleting this site removes its pages, content, and theme. This can’t
          be undone.
        </p>
        {confirmingDelete ? (
          <div className="pb-danger-confirm">
            <span className="pb-danger-confirm-label">
              Delete “{siteName || "this site"}”?
            </span>
            <div className="pb-danger-confirm-actions">
              <button
                type="button"
                className="pb-danger-cancel"
                onClick={() => setConfirmingDelete(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="pb-danger-delete"
                onClick={() => {
                  setConfirmingDelete(false);
                  deleteSite();
                  navigateTo("menu");
                }}
              >
                Delete site
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="pb-danger-button"
            disabled={isOnlySite}
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash size={15} weight="regular" />
            Delete site
          </button>
        )}
        {isOnlySite && (
          <p className="pb-panel-note">You can’t delete your only site.</p>
        )}
      </div>
    </>
  );
}
