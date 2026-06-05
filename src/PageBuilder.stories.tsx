import type { Meta, StoryObj } from "@storybook/react-vite";

import { Shell } from "./pageBuilder/Shell";
import { buildPersonalSiteDoc } from "./pageBuilder/demoDoc";

const meta: Meta = {
  title: "Page Builder",
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

export const PersonalSite: Story = {
  name: "Personal site",
  render: () => <Shell initialDoc={buildPersonalSiteDoc} />,
};
