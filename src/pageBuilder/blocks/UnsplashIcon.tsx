/**
 * Unsplash wordmark glyph, drawn to match the Phosphor icon signature
 * (`size` + ignored `weight`) so it drops straight into the block catalog
 * alongside the real Phosphor icons. Fills with `currentColor` so it
 * inherits the picker row's text color like every other icon.
 */

export function UnsplashIcon({ size = 16 }: { size?: number; weight?: unknown }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M15 4.5H9V8.5H15V4.5Z" />
      <path d="M4 10.5H9V14.5H15V10.5H20V19.5H4V10.5Z" />
    </svg>
  );
}
