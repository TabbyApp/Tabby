export function NewTabbyCatLogo() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Cat head */}
      <circle cx="24" cy="24" r="16" fill="url(#catGradient)" />
      
      {/* Left ear */}
      <path d="M12 16L8 8L16 12Z" fill="url(#catGradient)" />
      
      {/* Right ear */}
      <path d="M36 16L40 8L32 12Z" fill="url(#catGradient)" />
      
      {/* Inner left ear */}
      <path d="M12 15L10 10L15 12Z" fill="#FCD34D" />
      
      {/* Inner right ear */}
      <path d="M36 15L38 10L33 12Z" fill="#FCD34D" />
      
      {/* Eyes */}
      <circle cx="18" cy="22" r="2.5" fill="#1F2937" />
      <circle cx="30" cy="22" r="2.5" fill="#1F2937" />
      
      {/* Eye highlights */}
      <circle cx="19" cy="21.5" r="1" fill="white" />
      <circle cx="31" cy="21.5" r="1" fill="white" />
      
      {/* Nose */}
      <path d="M24 27L22 29L26 29Z" fill="#EC4899" />
      
      {/* Mouth */}
      <path d="M24 29C24 29 22 31 20 30M24 29C24 29 26 31 28 30" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" />
      
      {/* Whiskers left */}
      <line x1="14" y1="24" x2="8" y2="23" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="14" y1="26" x2="8" y2="28" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" />
      
      {/* Whiskers right */}
      <line x1="34" y1="24" x2="40" y2="23" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="34" y1="26" x2="40" y2="28" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" />
      
      {/* Stripes on head */}
      <path d="M20 12C20 12 22 14 24 14C26 14 28 12 28 12" stroke="#9333EA" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M18 16C18 16 20 17 24 17C28 17 30 16 30 16" stroke="#9333EA" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      
      <defs>
        <linearGradient id="catGradient" x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A855F7" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
    </svg>
  );
}
