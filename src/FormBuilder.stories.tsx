import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Schema } from "prosemirror-model";

import "./demoExtensions/formBuilder.css";

import {
  addClozeToSchema,
  blankKeymap,
  buildCloze,
  clozeNodeViewComponents,
} from "./demoExtensions/fillInTheBlank";
import { FormBuilderBubbleMenu } from "./demoExtensions/formBuilderBubble";
import {
  addQuizToSchema,
  buildQuiz,
  quizNodeViewComponents,
} from "./demoExtensions/multipleChoice";
import {
  createHandle,
  FormBuilderEditor,
  formBuilderMarkExtensions,
} from "./FormBuilderEditor";

/** Combined schema extender — quiz items + cloze items. */
const addFormBuilderSchema = (schema: Schema) =>
  addClozeToSchema(addQuizToSchema(schema));

const formItemDragHandles = {
  quiz: createHandle("Quiz"),
  cloze: createHandle("Cloze"),
};

const formItemNodeViewComponents = {
  ...quizNodeViewComponents,
  ...clozeNodeViewComponents,
};

const formItemPlugins = [blankKeymap()];
const formItemOverlays = (
  <FormBuilderBubbleMenu markExtensions={formBuilderMarkExtensions} />
);

const meta: Meta = {
  title: "Form Builder",
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

// ─────────────────────────────────────────── Empty shuffle

const buildEmptyDoc = (schema: Schema) =>
  schema.nodes["doc"]!.create(null, [
    schema.nodes["paragraph"]!.create(),
  ]);

export const EmptyShuffle: Story = {
  name: "Empty shuffle",
  render: () => (
    <div className="editor-shell">
      <h2 className="editor-title">
        Empty shuffle — drag blocks · select text for B / I / U / S
      </h2>
      <div className="editor-surface editor-surface--shuffle">
        <FormBuilderEditor
          initialDoc={buildEmptyDoc}
          overlays={
            <FormBuilderBubbleMenu markExtensions={formBuilderMarkExtensions} />
          }
        />
      </div>
    </div>
  ),
};

// ─────────────────────────────────────────── Reading + multiple choice quiz

const buildReadingQuizDoc = (schema: Schema) => {
  const p = (text: string) =>
    schema.nodes["paragraph"]!.create(null, schema.text(text));
  const h = (level: number, text: string) =>
    schema.nodes["heading"]!.create({ level }, schema.text(text));

  return schema.nodes["doc"]!.create(null, [
    schema.nodes["row"]!.create({ shuffleStart: 0, shuffleEnd: 13 }, [
      schema.nodes["container"]!.create({ shuffleStart: 1, shuffleEnd: 12 }, [
        h(1, "The Tortoise and the Hare"),
        p(
          "There was once a Hare who, boasting how he could run faster than anyone else, was forever teasing the Tortoise for its slowness. Then one day, the irate Tortoise answered back: \"Who do you think you are? There's no denying you're swift, but even you can be beaten!\"",
        ),
        p(
          "The Hare squealed with laughter. \"Beaten in a race? By whom? Not you, surely!\" he scoffed. \"I bet there's nobody in the world who can beat me, I'm so speedy. Now, why don't you try?\"",
        ),
        p(
          "Annoyed by such bragging, the Tortoise accepted the challenge. A course was planned, and the next day at dawn the two contestants stood at the starting line. The Hare yawned sleepily as the meek Tortoise trudged slowly off.",
        ),
        p(
          "When the Hare saw how painfully slow his rival was, he decided, half asleep on his feet, to have a quick nap. \"I have plenty of time to beat that Tortoise,\" he yawned. The Tortoise, meanwhile, plodded on. After a while, when the Hare woke up, he saw the Tortoise was just nearing the finishing line — and there was no way he could catch up. The Tortoise had won the race.",
        ),
      ]),
    ]),
    h(2, "Comprehension check"),
    buildQuiz(
      schema,
      "What is the moral of the story?",
      [
        { text: "Bragging always pays off." },
        { text: "Slow and steady wins the race.", correct: true },
        { text: "Always take a nap when racing." },
        { text: "Never accept a challenge." },
      ],
      { shuffleStart: 1, shuffleEnd: 12 },
    ),
    buildQuiz(
      schema,
      "Why did the Hare lose?",
      [
        { text: "He was injured during the race." },
        { text: "The Tortoise cheated." },
        { text: "He underestimated his opponent and napped.", correct: true },
        { text: "He ran in the wrong direction." },
      ],
      { shuffleStart: 1, shuffleEnd: 12 },
    ),
  ]);
};

export const ReadingWithQuiz: Story = {
  name: "Reading + multiple-choice quiz",
  render: () => (
    <div className="editor-shell">
      <h2 className="editor-title">
        Reading & quiz — radios pick the correct answer · drag blocks to reorder
      </h2>
      <div className="editor-surface editor-surface--shuffle">
        <FormBuilderEditor
          initialDoc={buildReadingQuizDoc}
          extendSchema={addFormBuilderSchema}
          extraNodeViewComponents={formItemNodeViewComponents}
          extraDragHandles={formItemDragHandles}
          extraPlugins={formItemPlugins}
          overlays={formItemOverlays}
        />
      </div>
    </div>
  ),
};

// ─────────────────────────────────────────── Reading + fill-in-the-blanks

const buildClozeDoc = (schema: Schema) => {
  const p = (text: string) =>
    schema.nodes["paragraph"]!.create(null, schema.text(text));
  const h = (level: number, text: string) =>
    schema.nodes["heading"]!.create({ level }, schema.text(text));

  return schema.nodes["doc"]!.create(null, [
    schema.nodes["row"]!.create({ shuffleStart: 0, shuffleEnd: 13 }, [
      schema.nodes["container"]!.create({ shuffleStart: 1, shuffleEnd: 12 }, [
        h(1, "Photosynthesis"),
        p(
          "Plants make their own food using sunlight. They store the food as sugar and release oxygen as a side product. The two cloze items below ask you to fill in the missing terms.",
        ),
        h(2, "Practice"),
        buildCloze(
          schema,
          [
            "Plants make their own food through a process called ",
            { blank: "photosynthesis" },
            ". This happens mostly inside organelles called ",
            { blank: "chloroplasts" },
            ", which contain a green pigment named ",
            { blank: "chlorophyll" },
            ".",
          ],
          { shuffleStart: 1, shuffleEnd: 12 },
        ),
        buildCloze(
          schema,
          [
            "The basic reaction takes carbon dioxide and water, plus energy from sunlight, and produces ",
            { blank: "glucose" },
            " and ",
            { blank: "oxygen" },
            ". Animals breathe in the oxygen plants release.",
          ],
          { shuffleStart: 1, shuffleEnd: 12 },
        ),
        p(
          "Click inside any cloze prompt above, highlight a word, and the bubble lets you mark it as a blank (or remove an existing one). Highlighting elsewhere in the document does nothing — the action is scoped to cloze prompts.",
        ),
      ]),
    ]),
  ]);
};

export const ReadingWithBlanks: Story = {
  name: "Reading + fill-in-the-blanks",
  render: () => (
    <div className="editor-shell">
      <h2 className="editor-title">
        Fill-in-the-blanks — highlight inside a prompt to toggle a blank
      </h2>
      <div className="editor-surface editor-surface--shuffle">
        <FormBuilderEditor
          initialDoc={buildClozeDoc}
          extendSchema={addFormBuilderSchema}
          extraNodeViewComponents={formItemNodeViewComponents}
          extraDragHandles={formItemDragHandles}
          extraPlugins={formItemPlugins}
          overlays={formItemOverlays}
        />
      </div>
    </div>
  ),
};
