const AurumLogo = ({ className = "w-16 h-16" }: { className?: string }) => {
  return (
    <svg 
      className={`${className} text-[hsl(var(--aurum-gold))]`} 
      fill="currentColor" 
      viewBox="0 0 24 24" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-9.5h4c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5h-4c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5zm0 5h4c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5h-4c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5z" />
    </svg>
  );
};

export default AurumLogo;