export function TabbyCatLogo() {
  return (
    <div className="relative">
      <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Rounded square background - app icon style */}
        <rect 
          x="10" 
          y="10" 
          width="80" 
          height="80" 
          rx="20" 
          fill="url(#iconGradient)"
        />
        
        {/* Simple geometric cat face */}
        
        {/* Cat ears - triangular */}
        <path 
          d="M 30 28 L 22 18 L 35 22 Z" 
          fill="#F1F5F9"
        />
        <path 
          d="M 70 28 L 78 18 L 65 22 Z" 
          fill="#F1F5F9"
        />
        
        {/* Cat head - rounded */}
        <circle cx="50" cy="50" r="22" fill="#F1F5F9" />
        
        {/* Eyes - simple dots */}
        <circle cx="42" cy="48" r="3.5" fill="#1E293B" />
        <circle cx="58" cy="48" r="3.5" fill="#1E293B" />
        
        {/* Eye highlights */}
        <circle cx="43" cy="47" r="1.2" fill="white" />
        <circle cx="59" cy="47" r="1.2" fill="white" />
        
        {/* Nose - simple triangle */}
        <path 
          d="M 50 54 L 47 58 L 53 58 Z" 
          fill="#3B82F6"
        />
        
        {/* Mouth - simple curved lines */}
        <path 
          d="M 50 58 Q 45 61 42 59" 
          stroke="#64748B" 
          strokeWidth="2" 
          fill="none" 
          strokeLinecap="round"
        />
        <path 
          d="M 50 58 Q 55 61 58 59" 
          stroke="#64748B" 
          strokeWidth="2" 
          fill="none" 
          strokeLinecap="round"
        />
        
        {/* Whiskers - minimal */}
        <line x1="28" y1="50" x2="36" y2="49" stroke="#F1F5F9" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
        <line x1="28" y1="54" x2="36" y2="53" stroke="#F1F5F9" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
        <line x1="72" y1="50" x2="64" y2="49" stroke="#F1F5F9" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
        <line x1="72" y1="54" x2="64" y2="53" stroke="#F1F5F9" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
        
        {/* Simple stripe markings on forehead */}
        <path 
          d="M 44 38 Q 47 36 50 38" 
          stroke="#94A3B8" 
          strokeWidth="2" 
          fill="none" 
          strokeLinecap="round"
        />
        <path 
          d="M 50 38 Q 53 36 56 38" 
          stroke="#94A3B8" 
          strokeWidth="2" 
          fill="none" 
          strokeLinecap="round"
        />
        
        <defs>
          <linearGradient id="iconGradient" x1="50" y1="10" x2="50" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
