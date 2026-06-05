/**
 * "+ Add block" popover. Modelled on pagy's slash-menu / picker UX:
 * a search input at the top, then the catalog grouped by category
 * with one icon-prefixed row per block. Filtering hides empty groups
 * and respects each entry's `searchOnly` flag.
 *
 * Anchored to the trigger via @radix-ui/react-popover so we get
 * focus management, escape-to-close, and outside-click-to-close for
 * free. The picker portals into `document.body` so it floats above
 * the canvas frame's `overflow: hidden`.
 */

"use client";

import {
  forwardRef,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as RadixPopover from "@radix-ui/react-popover";
import { MagnifyingGlass } from "@phosphor-icons/react";

import {
  BLOCK_CATALOG,
  BLOCK_GROUPS,
  type BlockCatalogEntry,
} from "./catalog";

interface BlockPickerProps {
  trigger: ReactNode;
  /** Called when the user picks a block. */
  onPick: (entry: BlockCatalogEntry) => void;
  /** Optional initial query, e.g. when slash-menu is wired up later. */
  initialQuery?: string;
  /** Popover side relative to the trigger — default "right". */
  side?: RadixPopover.PopoverContentProps["side"];
}

export const BlockPicker = forwardRef<HTMLButtonElement, BlockPickerProps>(
  function BlockPicker({ trigger, onPick, initialQuery = "", side = "right" }, _ref) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState(initialQuery);

    const filtered = useMemo(() => {
      const norm = q.trim().toLowerCase();
      return BLOCK_CATALOG.filter((entry) => {
        if (norm) {
          return entry.name.toLowerCase().includes(norm);
        }
        return !entry.searchOnly;
      });
    }, [q]);

    const groups = useMemo(() => {
      return BLOCK_GROUPS.map((g) => ({
        group: g,
        items: filtered.filter((e) => e.group === g),
      })).filter((g) => g.items.length > 0);
    }, [filtered]);

    const pickAndClose = (entry: BlockCatalogEntry) => {
      onPick(entry);
      setOpen(false);
      setQ("");
    };

    return (
      <RadixPopover.Root open={open} onOpenChange={setOpen}>
        <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
        <RadixPopover.Portal>
          <RadixPopover.Content
            className="pb-block-picker"
            side={side}
            align="start"
            sideOffset={8}
          >
            <div className="pb-block-picker-search">
              <MagnifyingGlass size={14} weight="regular" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search blocks…"
                autoFocus
              />
            </div>
            <div className="pb-block-picker-body">
              {groups.length === 0 && (
                <div className="pb-block-picker-empty">No blocks found</div>
              )}
              {groups.map(({ group, items }) => (
                <div key={group} className="pb-block-picker-group">
                  <div className="pb-block-picker-group-label">{group}</div>
                  {items.map((entry) => {
                    const Icon = entry.icon;
                    return (
                      <button
                        key={`${entry.type}-${entry.name}`}
                        type="button"
                        className="pb-block-picker-item"
                        onClick={() => pickAndClose(entry)}
                      >
                        <Icon size={16} weight="regular" />
                        <span>{entry.name}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </RadixPopover.Content>
        </RadixPopover.Portal>
      </RadixPopover.Root>
    );
  },
);
