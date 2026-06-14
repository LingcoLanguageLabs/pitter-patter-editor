/**
 * Renders a page's cached thumbnail image, or a title card while none
 * exists yet. The single, standardized thumbnail surface — reused by the
 * Pages filmstrip now and the flowchart canvas later.
 */

import { usePageBuilderStore } from "./store";

export function PageThumbnail({
  pageId,
  title,
}: {
  pageId: string;
  title: string;
}) {
  const url = usePageBuilderStore((s) => s.pageThumbs[pageId]);
  if (url) {
    return (
      <img
        className="pb-page-img"
        src={url}
        alt={title}
        loading="lazy"
        draggable={false}
      />
    );
  }
  return <span className="pb-page-title">{title}</span>;
}
