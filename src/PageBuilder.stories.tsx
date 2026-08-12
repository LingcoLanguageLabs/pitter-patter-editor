import type { Meta, StoryObj } from "@storybook/react-vite";

import { Shell } from "./pageBuilder/Shell";

const meta: Meta = {
  title: "Page Builder",
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

// The deck of sample sites lives in the store's catalog (`./pageBuilder/sites`);
// each story just pins which one loads first. The in-app site picker switches
// between them all (and "+ New site" mints fresh ones) at runtime.

export const PersonalSite: Story = {
  name: "Personal site",
  render: () => <Shell initialSiteId="yag1" />,
};

export const LayoutTest: Story = {
  name: "Layout test (row + card)",
  render: () => <Shell initialSiteId="layout-lab" />,
};

export const BlankSite: Story = {
  name: "Totally blank",
  render: () => <Shell initialSiteId="totally-blank" />,
};
