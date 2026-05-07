import { useStatistics } from "./editor/extensions";

/**
 * A small status bar reading the live document statistics. Renders
 * inside `<editor.Editor>` so the underlying hook can subscribe to the
 * editor state.
 */
export function StatsBar() {
  const { characters, words, paragraphs, headings, readingTimeMinutes } =
    useStatistics();

  const minutes = Math.max(1, Math.round(readingTimeMinutes));
  const formattedReading = readingTimeMinutes < 1
    ? "< 1 min"
    : `${minutes} min read`;

  return (
    <div className="pp-stats-bar" role="status" aria-live="polite">
      <Stat label="Words" value={words.toLocaleString()} />
      <Stat label="Characters" value={characters.toLocaleString()} />
      <Stat label="Paragraphs" value={paragraphs.toLocaleString()} />
      <Stat label="Headings" value={headings.toLocaleString()} />
      <Stat label="Reading time" value={formattedReading} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="pp-stats-cell">
      <span className="pp-stats-value">{value}</span>
      <span className="pp-stats-label">{label}</span>
    </div>
  );
}
