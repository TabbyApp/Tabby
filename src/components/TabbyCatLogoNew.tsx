export function TabbyCatLogoNew() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Main card shape */}
      <rect x="4" y="8" width="32" height="24" rx="4" fill="url(#cardGradient)" />
      
      {/* Card stripe */}
      <rect x="4" y="13" width="32" height="3" fill="#1F2937" opacity="0.2" />
      
      {/* Cat face on card */}
      <g transform="translate(12, 18)">
        {/* Ears */}
        <path d="M4 0L2 -3L6 -2Z" fill="#FCD34D" />
        <path d="M12 0L10 -3L14 -2Z" fill="#FCD34D" />
        
        {/* Head */}
        <circle cx="8" cy="2" r="5" fill="#FCD34D" />
        
        {/* Eyes */}
        <circle cx="6" cy="2" r="1" fill="#1F2937" />
        <circle cx="10" cy="2" r="1" fill="#1F2937" />
        
        {/* Nose */}
        <circle cx="8" cy="3.5" r="0.5" fill="#EC4899" />
        
        {/* Whiskers */}
        <line x1="3" y1="2.5" x2="1" y2="2.5" stroke="#1F2937" strokeWidth="0.5" />
        <line x1="13" y1="2.5" x2="15" y2="2.5" stroke="#1F2937" strokeWidth="0.5" />
      </g>
      
      {/* Money symbol */}
      <text x="28" y="30" fontSize="10" fontWeight="bold" fill="white">$</text>
      
      <defs>
        <linearGradient id="cardGradient" x1="4" y1="8" x2="36" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9333EA" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
    </svg>
  );
}
