import { Smiley } from "@phosphor-icons/react";

import { createSuggestionPlugin, SuggestionPopover } from "../menu";
import { Extension } from "../types";

const { plugin, key } = createSuggestionPlugin({ char: ":" });

interface EmojiEntry {
  char: string;
  name: string;
  keywords?: string[];
}

const EMOJIS: EmojiEntry[] = [
  { char: "😀", name: "smile", keywords: ["happy", "grin"] },
  { char: "😂", name: "joy", keywords: ["laugh", "lol", "cry"] },
  { char: "🤣", name: "rofl", keywords: ["laugh", "rolling"] },
  { char: "😊", name: "blush", keywords: ["smile", "happy"] },
  { char: "😍", name: "heart_eyes", keywords: ["love"] },
  { char: "😘", name: "kiss", keywords: ["love"] },
  { char: "😎", name: "sunglasses", keywords: ["cool"] },
  { char: "🤔", name: "thinking", keywords: ["hmm"] },
  { char: "😴", name: "sleep", keywords: ["tired", "zzz"] },
  { char: "🙄", name: "eye_roll", keywords: ["ugh"] },
  { char: "😢", name: "cry", keywords: ["sad", "tear"] },
  { char: "😭", name: "sob", keywords: ["sad", "cry"] },
  { char: "😡", name: "angry", keywords: ["mad", "rage"] },
  { char: "🤯", name: "mind_blown", keywords: ["wow", "shock"] },
  { char: "😱", name: "scream", keywords: ["shock", "afraid"] },
  { char: "🥳", name: "party", keywords: ["celebrate"] },
  { char: "🤝", name: "handshake", keywords: ["deal", "agree"] },
  { char: "👍", name: "thumbsup", keywords: ["yes", "approve", "+1"] },
  { char: "👎", name: "thumbsdown", keywords: ["no", "-1"] },
  { char: "👏", name: "clap", keywords: ["applause"] },
  { char: "🙏", name: "pray", keywords: ["thanks", "please"] },
  { char: "💪", name: "muscle", keywords: ["strong"] },
  { char: "👀", name: "eyes", keywords: ["look", "see"] },
  { char: "✋", name: "hand", keywords: ["stop", "wave"] },
  { char: "👋", name: "wave", keywords: ["hi", "hello", "bye"] },
  { char: "🤷", name: "shrug", keywords: ["dunno"] },
  { char: "❤️", name: "heart", keywords: ["love", "red"] },
  { char: "💔", name: "broken_heart", keywords: ["sad"] },
  { char: "💯", name: "hundred", keywords: ["perfect", "100"] },
  { char: "🔥", name: "fire", keywords: ["hot", "lit"] },
  { char: "✨", name: "sparkles", keywords: ["new", "shiny"] },
  { char: "⭐", name: "star", keywords: ["favorite"] },
  { char: "🚀", name: "rocket", keywords: ["launch", "ship"] },
  { char: "🎉", name: "tada", keywords: ["party", "celebrate"] },
  { char: "🎊", name: "confetti", keywords: ["party"] },
  { char: "🐛", name: "bug", keywords: ["fix", "debug"] },
  { char: "🐶", name: "dog", keywords: ["puppy"] },
  { char: "🐱", name: "cat", keywords: ["kitty"] },
  { char: "🌎", name: "earth", keywords: ["world", "globe"] },
  { char: "☕", name: "coffee", keywords: ["drink", "morning"] },
  { char: "🍕", name: "pizza", keywords: ["food"] },
  { char: "🎂", name: "cake", keywords: ["birthday"] },
  { char: "📌", name: "pin", keywords: ["note"] },
  { char: "📝", name: "memo", keywords: ["note", "write"] },
  { char: "💡", name: "bulb", keywords: ["idea"] },
  { char: "✅", name: "check", keywords: ["done", "yes"] },
  { char: "❌", name: "x", keywords: ["no", "cancel"] },
  { char: "⚠️", name: "warning", keywords: ["alert"] },
  { char: "🔒", name: "lock", keywords: ["secure"] },
  { char: "🔓", name: "unlock", keywords: ["open"] },
];

function filterEmojis(query: string): EmojiEntry[] {
  if (!query) return EMOJIS.slice(0, 12);
  const q = query.toLowerCase();
  return EMOJIS.filter((e) => {
    if (e.name.includes(q)) return true;
    if (e.keywords?.some((k) => k.includes(q))) return true;
    return false;
  }).slice(0, 24);
}

export const Emoji = Extension.create({
  name: "emoji",
  plugins: () => [plugin],
  meta: { label: "Emoji", group: "inline", Icon: Smiley },
});

export function EmojiPopover() {
  return (
    <SuggestionPopover<EmojiEntry>
      pluginKey={key}
      items={(query) => filterEmojis(query)}
      onSelect={({ view, range, item }) => {
        const tr = view.state.tr.delete(range.from, range.to);
        tr.insertText(`${item.char} `, range.from);
        view.dispatch(tr);
        view.focus();
      }}
      renderItem={({ item }) => (
        <div className="pp-emoji-row">
          <span className="pp-emoji-char">{item.char}</span>
          <span className="pp-emoji-name">:{item.name}:</span>
        </div>
      )}
      placement="bottom-start"
    />
  );
}
