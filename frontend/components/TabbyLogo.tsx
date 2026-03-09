// Minimal abstract cat-inspired logo for Tabby (design system)
// Monochromatic, clean, geometric

export function TabbyLogo({ className = "", size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M6 12C6 9.79086 7.79086 8 10 8H12C12 5.79086 13.7909 4 16 4C18.2091 4 20 5.79086 20 8H22C24.2091 8 26 9.79086 26 12V22C26 25.3137 23.3137 28 20 28H12C8.68629 28 6 25.3137 6 22V12Z"
        className="fill-foreground"
      />
      <path
        d="M10 8L8 4C7.44772 4 7 4.44772 7 5V10L10 8Z"
        className="fill-foreground"
      />
      <path
        d="M22 8L24 4C24.5523 4 25 4.44772 25 5V10L22 8Z"
        className="fill-foreground"
      />
    </svg>
  );
}

export function TabbyWordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <TabbyLogo size={36} />
      <span className="text-2xl font-semibold tracking-tight text-foreground">Tabby</span>
    </div>
  );
}
