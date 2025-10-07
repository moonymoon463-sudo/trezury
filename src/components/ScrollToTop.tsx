import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll window to top
    window.scrollTo(0, 0);
    
    // Scroll all overflow containers to top
    const scrollableElements = document.querySelectorAll(
      'main, [class*="overflow-auto"], [class*="overflow-y-auto"], .overflow-auto, .overflow-y-auto'
    );
    
    scrollableElements.forEach((element) => {
      if (element instanceof HTMLElement) {
        element.scrollTop = 0;
      }
    });
  }, [pathname]);

  return null;
}