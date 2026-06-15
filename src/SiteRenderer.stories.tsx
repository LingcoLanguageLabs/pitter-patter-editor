import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  buildLayoutTestDoc,
  buildPersonalSiteDoc,
} from "./pageBuilder/demoDoc";
import { createPageBuilderSchema } from "./pageBuilder/schemaFactory";
import { SiteRenderer } from "./pageBuilder/runtime/SiteRenderer";
import type { JsonNode } from "./pageBuilder/runtime/shuffleLayout";
import { DEFAULT_THEME } from "./pageBuilder/store";

// Build the demo decks once, then hand the renderer plain JSON — the same
// shape a publish step would persist. This proves the published render is
// fully decoupled from ProseMirror.
const schema = createPageBuilderSchema();
const docJson = buildPersonalSiteDoc(schema).toJSON() as JsonNode;
const layoutJson = buildLayoutTestDoc(schema).toJSON() as JsonNode;

const meta: Meta<typeof SiteRenderer> = {
  title: "Page Builder/Site Renderer",
  component: SiteRenderer,
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj<typeof SiteRenderer>;

export const PublishedSite: Story = {
  name: "Published site (no ProseMirror)",
  render: () => <SiteRenderer doc={docJson} theme={DEFAULT_THEME} />,
};

export const LayoutCoverage: Story = {
  name: "Layout coverage (row + card)",
  render: () => <SiteRenderer doc={layoutJson} theme={DEFAULT_THEME} />,
};
