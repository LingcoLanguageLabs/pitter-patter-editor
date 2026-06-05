/**
 * Radix-backed select. Mirrors pagy.co's `src/editor/form/combobox.tsx`
 * (the unminified `l6` / `OQ` / `s3` exports), trimmed to the API the
 * page builder actually uses today:
 *
 *   <Combobox value onValueChange>
 *     <ComboboxGroup label="Sans Serif">
 *       <ComboboxItem value="Karla">Karla</ComboboxItem>
 *       …
 *     </ComboboxGroup>
 *   </Combobox>
 *
 * Skipped vs pagy: the `react-hook-form`-aware `ComboboxField` wrapper
 * — pitter-patter mutates the store directly so there's no Controller
 * to register. Add it later if/when the form layer comes online.
 *
 * Phosphor icons instead of lucide (pitter-patter already depends on
 * @phosphor-icons/react and the visual difference is negligible).
 */

"use client";

import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import * as RadixSelect from "@radix-ui/react-select";
import {
  CaretDown,
  CaretUpDown,
  CaretUp,
  Check,
} from "@phosphor-icons/react";

interface ComboboxProps
  extends Omit<RadixSelect.SelectProps, "children">,
    Pick<ComponentPropsWithoutRef<typeof RadixSelect.Trigger>, "onMouseLeave"> {
  children?: ReactNode;
  size?: string;
  className?: string;
  placeholder?: string;
  /** What the trigger renders when a value is selected (defaults to value). */
  display?: ReactNode;
  /** Inline style on the trigger — used by FontsPanel so the picker
   *  itself renders in the chosen font face. */
  triggerStyle?: React.CSSProperties;
}

export const Combobox = forwardRef<HTMLButtonElement, ComboboxProps>(
  function Combobox(
    {
      children,
      size,
      className,
      placeholder,
      display,
      onMouseLeave,
      triggerStyle,
      ...rest
    },
    ref,
  ) {
    const trigger = ["pb-custom-select", size && `-${size}`, className]
      .filter(Boolean)
      .join(" ");
    return (
      <RadixSelect.Root {...rest}>
        <RadixSelect.Trigger ref={ref} className={trigger} style={triggerStyle}>
          <RadixSelect.Value placeholder={placeholder}>
            {display}
          </RadixSelect.Value>
          <RadixSelect.Icon className="pb-custom-select-indicator">
            <CaretUpDown size={14} weight="regular" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>
        <RadixSelect.Portal>
          <RadixSelect.Content
            className={[
              "pb-custom-select-content",
              size && `-${size}`,
            ]
              .filter(Boolean)
              .join(" ")}
            position="popper"
            sideOffset={4}
            onMouseLeave={onMouseLeave as any}
          >
            <RadixSelect.ScrollUpButton className="pb-custom-select-scroll">
              <CaretUp size={14} weight="regular" />
            </RadixSelect.ScrollUpButton>
            <RadixSelect.Viewport className="pb-custom-select-viewport">
              {children}
            </RadixSelect.Viewport>
            <RadixSelect.ScrollDownButton className="pb-custom-select-scroll">
              <CaretDown size={14} weight="regular" />
            </RadixSelect.ScrollDownButton>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
    );
  },
);

export const ComboboxItem = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixSelect.Item> & { children?: ReactNode }
>(function ComboboxItem({ children, className, ...rest }, ref) {
  return (
    <RadixSelect.Item
      {...rest}
      ref={ref}
      className={["pb-custom-select-option", className].filter(Boolean).join(" ")}
    >
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator className="pb-custom-select-check">
        <Check size={14} weight="bold" />
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  );
});

export const ComboboxGroup = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixSelect.Group> & {
    label?: ReactNode;
    children?: ReactNode;
  }
>(function ComboboxGroup({ children, label, ...rest }, ref) {
  return (
    <RadixSelect.Group {...rest} ref={ref} className="pb-custom-select-group">
      {label && (
        <RadixSelect.Label className="pb-custom-select-label">
          {label}
        </RadixSelect.Label>
      )}
      {children}
    </RadixSelect.Group>
  );
});
