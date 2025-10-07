import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    const scrollAllToTop = () => {
      // Window & document scrolling elements
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      try {
        document.scrollingElement && (document.scrollingElement.scrollTop = 0);
      } catch {}
      try {
        (document.documentElement as HTMLElement).scrollTop = 0;
        (document.body as HTMLElement).scrollTop = 0;
      } catch {}

      // Common app scroll containers (AppLayout main + any overflow containers)
      const selectors = [
        'main',
        '[data-scroll-container]',
        '.overflow-auto',
        '.overflow-y-auto',
        '[class*="overflow-auto"]',
        '[class*="overflow-y-auto"]'
      ];
      const scrollableElements = document.querySelectorAll(selectors.join(','));
      scrollableElements.forEach((el) => {
        if (el instanceof HTMLElement) {
          el.scrollTop = 0;
          el.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
        }
      });
    };

    // Run immediately, next frame, and after microtask to cover layout shifts
    scrollAllToTop();
    requestAnimationFrame(scrollAllToTop);
    setTimeout(scrollAllToTop, 0);
  }, [pathname]);

  return null;
}