/**
 * RESULTS_TEMPLATES — the "scoring screen" as add-section presets. These combine
 * `{{ }}` variable interpolation (the learner's name + score numbers) with a
 * progress block bound to `score.percent`, so dropping one in builds a complete
 * results page. A "Submit" button (Check activity) typically grades and
 * navigates to the page holding one of these.
 */

import { heading, paragraph, progress, section } from "./builders";
import type { SectionTemplate } from "./builders";

export const RESULTS_TEMPLATES: SectionTemplate[] = [
  // Ring + congratulatory line.
  section({ padding: "large", minHeight: "medium", contentAlign: "center" }, [
    heading(1, "Nice job, {{learner.first_name}}!", {
      align: "center",
      start: 3,
      end: 10,
    }),
    paragraph(
      "You scored {{score.earned}} / {{score.possible}} — {{score.percent}}%.",
      { align: "center", size: "l", start: 3, end: 10 },
    ),
    progress({ display: "ring", value: "score.percent", start: 5, end: 8 }),
  ]),

  // Bar + breakdown.
  section({ padding: "large", minHeight: "medium", contentAlign: "center" }, [
    heading(2, "Your results", { align: "center", start: 3, end: 10 }),
    progress({
      display: "bar",
      value: "score.percent",
      label: "Score",
      start: 3,
      end: 10,
    }),
    paragraph("{{score.correct}} of {{score.total}} correct.", {
      align: "center",
      size: "m",
      start: 3,
      end: 10,
    }),
  ]),
];
