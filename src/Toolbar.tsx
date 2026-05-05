import { Fragment } from "react";

import { useEditor } from "./editor";
import { Toolbar as ToolbarPrimitive, TooltipProvider } from "./editor/menu";

export function Toolbar() {
  const { extensions } = useEditor();

  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={300}>
      <ToolbarPrimitive variant="fixed">
        {extensions.map((ext, idx) => {
          const ToolbarItem = ext.toolbar;
          if (!ToolbarItem) return null;
          return (
            <Fragment key={`${ext.name}-${idx}`}>
              <ToolbarItem />
            </Fragment>
          );
        })}
      </ToolbarPrimitive>
    </TooltipProvider>
  );
}
