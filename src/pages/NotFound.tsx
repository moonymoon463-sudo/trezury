import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-[100dvh] w-full overflow-x-hidden items-center justify-center bg-background">
      <div className="text-center px-4 sm:px-6 lg:px-8 max-w-full">
        <h1 className="mb-4 text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground">404</h1>
        <p className="mb-6 text-lg sm:text-xl text-muted-foreground break-words">Oops! Page not found</p>
        <a href="/" className="text-primary hover:text-primary/80 underline text-base sm:text-lg transition-colors">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
