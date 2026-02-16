export function TabbyLogoFinal() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Purple gradient background circle */}
      <circle cx="20" cy="20" r="18" fill="url(#purpleGradient)" />
      
      {/* Cat face */}
      <g transform="translate(20, 20)">
        {/* Ears */}
        <path d="M-8 -8L-6 -12L-4 -8Z" fill="#FCD34D" />
        <path d="M8 -8L6 -12L4 -8Z" fill="#FCD34D" />
        
        {/* Face circle */}
        <circle cx="0" cy="0" r="8" fill="#FCD34D" />
        
        {/* Eyes */}
        <circle cx="-3" cy="-1" r="1.5" fill="#1F2937" />
        <circle cx="3" cy="-1" r="1.5" fill="#1F2937" />
        
        {/* Nose */}
        <path d="M0 1L-1 2.5L1 2.5Z" fill="#EC4899" />
        
        {/* Mouth */}
        <path d="M0 2.5C0 2.5 -2 4 -3 3M0 2.5C0 2.5 2 4 3 3" stroke="#1F2937" strokeWidth="0.8" strokeLinecap="round" />
        
        {/* Whiskers */}
        <line x1="-5" y1="0" x2="-8" y2="-0.5" stroke="#1F2937" strokeWidth="0.5" />
        <line x1="-5" y1="1" x2="-8" y2="1.5" stroke="#1F2937" strokeWidth="0.5" />
        <line x1="5" y1="0" x2="8" y2="-0.5" stroke="#1F2937" strokeWidth="0.5" />
        <line x1="5" y1="1" x2="8" y2="1.5" stroke="#1F2937" strokeWidth="0.5" />
      </g>
      
      <defs>
        <linearGradient id="purpleGradient" x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A855F7" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
    </svg>
  );
}
