import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll the window to top
    window.scrollTo(0, 0);
    
    // Also scroll any scrollable containers to top
    const scrollContainers = document.querySelectorAll('[data-scroll-container], main, .overflow-auto');
    scrollContainers.forEach((container) => {
      container.scrollTop = 0;
    });
  }, [pathname]);

  return null;
}