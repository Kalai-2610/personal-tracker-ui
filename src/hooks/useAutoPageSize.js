import { useCallback, useLayoutEffect, useRef, useState } from 'react';

const DEFAULT_PAGE_SIZE = 10;
const FALLBACK_ROW_HEIGHT = 58;
const HEIGHT_BUFFER = 4;

export default function useAutoPageSize({ defaultSize = DEFAULT_PAGE_SIZE, minSize = 1 } = {}) {
  const [container, setContainer] = useState(null);
  const [pageSize, setPageSize] = useState(defaultSize);
  const rowHeightRef = useRef(FALLBACK_ROW_HEIGHT);
  const containerRef = useCallback(node => setContainer(node), []);

  useLayoutEffect(() => {
    if (!container) return undefined;

    let frame = 0;
    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const headerHeight = container.querySelector('thead')?.getBoundingClientRect().height || 0;
        const rowHeight = container.querySelector('tbody tr')?.getBoundingClientRect().height;
        if (rowHeight) rowHeightRef.current = rowHeight;
        const availableHeight = container.clientHeight - headerHeight - HEIGHT_BUFFER;
        const nextSize = Math.max(minSize, Math.floor(availableHeight / rowHeightRef.current));
        setPageSize(current => current === nextSize ? current : nextSize);
      });
    };

    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(container);
    const mutationObserver = new MutationObserver(measure);
    mutationObserver.observe(container, { childList: true, subtree: true });
    window.addEventListener('resize', measure);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [container, minSize]);

  return [containerRef, pageSize];
}
