import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon';
  theme?: 'dark' | 'light' | 'auto';
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  variant = 'full',
  theme = 'dark',
}) => {
  // Dimensions
  const sizes = {
    sm: { icon: 34, width: variant === 'full' ? 140 : 34, height: 34 },
    md: { icon: 42, width: variant === 'full' ? 175 : 42, height: 42 },
    lg: { icon: 60, width: variant === 'full' ? 240 : 60, height: 60 },
    xl: { icon: 84, width: variant === 'full' ? 320 : 84, height: 84 },
  }[size];

  const textColor = theme === 'dark' ? '#F5F5F4' : '#1C1917';
  const leftArcColor = theme === 'dark' ? '#E7E5E4' : '#1C1917';

  if (variant === 'icon') {
    return (
      <svg
        viewBox="0 0 340 340"
        width={sizes.icon}
        height={sizes.icon}
        className={`select-none shrink-0 ${className}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="logoPieceGradIcon" cx="38%" cy="36%" r="62%">
            <stop offset="0%" stopColor="#FFFDF7" />
            <stop offset="45%" stopColor="#F5E8D0" />
            <stop offset="85%" stopColor="#E2CCA3" />
            <stop offset="100%" stopColor="#CBB184" />
          </radialGradient>
          <filter id="logoPieceShadowIcon" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000000" floodOpacity="0.4" />
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.25" />
          </filter>
        </defs>

        <g transform="translate(170, 170)">
          {/* RETICLE Left Arc */}
          <g stroke={leftArcColor} strokeWidth="12" fill="none" strokeLinecap="square">
            <line x1="-155" y1="0" x2="-80" y2="0" />
            <path d="M 0 -125 A 125 125 0 0 0 -125 0 A 125 125 0 0 0 0 125" />
            <line x1="0" y1="-125" x2="0" y2="-98" />
            <line x1="0" y1="125" x2="0" y2="98" />
          </g>

          {/* RETICLE Right Arc (Gold) */}
          <g stroke="#C5A059" strokeWidth="12" fill="none" strokeLinecap="square">
            <line x1="80" y1="0" x2="155" y2="0" />
            <path d="M 12 -125 A 125 125 0 0 1 125 0 A 125 125 0 0 1 12 125" />
          </g>

          {/* 3D Piece */}
          <g filter="url(#logoPieceShadowIcon)">
            <circle cx="0" cy="0" r="74" fill="url(#logoPieceGradIcon)" stroke="#FFFFFF" strokeWidth="2" />
            <circle cx="0" cy="0" r="72" fill="none" stroke="#C4A878" strokeWidth="1" opacity="0.6" />
            <circle cx="0" cy="0" r="60" fill="none" stroke="#B89B6C" strokeWidth="2.2" opacity="0.85" />
            <text
              x="0"
              y="22"
              textAnchor="middle"
              fontFamily="'Noto Serif TC', 'SimSun', serif"
              fontWeight="900"
              fontSize="62"
              fill="#18181B"
              style={{ letterSpacing: '-2px', textShadow: '0 1px 1px rgba(255,255,255,0.7)' }}
            >
              將
            </text>
          </g>
        </g>
      </svg>
    );
  }

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Icon portion */}
      <svg
        viewBox="0 0 340 340"
        width={sizes.icon}
        height={sizes.icon}
        className="shrink-0"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id={`logoPieceGradFull_${size}`} cx="38%" cy="36%" r="62%">
            <stop offset="0%" stopColor="#FFFDF7" />
            <stop offset="45%" stopColor="#F5E8D0" />
            <stop offset="85%" stopColor="#E2CCA3" />
            <stop offset="100%" stopColor="#CBB184" />
          </radialGradient>
          <filter id={`logoPieceShadowFull_${size}`} x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000000" floodOpacity="0.45" />
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.25" />
          </filter>
        </defs>

        <g transform="translate(170, 170)">
          {/* RETICLE Left Arc */}
          <g stroke={leftArcColor} strokeWidth="12" fill="none" strokeLinecap="square">
            <line x1="-155" y1="0" x2="-80" y2="0" />
            <path d="M 0 -125 A 125 125 0 0 0 -125 0 A 125 125 0 0 0 0 125" />
            <line x1="0" y1="-125" x2="0" y2="-98" />
            <line x1="0" y1="125" x2="0" y2="98" />
          </g>

          {/* RETICLE Right Arc (Gold) */}
          <g stroke="#C5A059" strokeWidth="12" fill="none" strokeLinecap="square">
            <line x1="80" y1="0" x2="155" y2="0" />
            <path d="M 12 -125 A 125 125 0 0 1 125 0 A 125 125 0 0 1 12 125" />
          </g>

          {/* 3D Piece */}
          <g filter={`url(#logoPieceShadowFull_${size})`}>
            <circle cx="0" cy="0" r="74" fill={`url(#logoPieceGradFull_${size})`} stroke="#FFFFFF" strokeWidth="2" />
            <circle cx="0" cy="0" r="72" fill="none" stroke="#C4A878" strokeWidth="1" opacity="0.6" />
            <circle cx="0" cy="0" r="60" fill="none" stroke="#B89B6C" strokeWidth="2.2" opacity="0.85" />
            <text
              x="0"
              y="22"
              textAnchor="middle"
              fontFamily="'Noto Serif TC', 'SimSun', serif"
              fontWeight="900"
              fontSize="62"
              fill="#18181B"
              style={{ letterSpacing: '-2px', textShadow: '0 1px 1px rgba(255,255,255,0.7)' }}
            >
              將
            </text>
          </g>
        </g>
      </svg>

      {/* Typography portion */}
      <div className="flex flex-col justify-center leading-none">
        <span
          className="font-black tracking-[0.24em] uppercase text-stone-100"
          style={{
            fontSize: size === 'sm' ? '14px' : size === 'md' ? '17px' : size === 'lg' ? '24px' : '32px',
            color: textColor,
          }}
        >
          XIANGQI
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="h-[1px] w-3 bg-[#C5A059]/70" />
          <span
            className="font-bold tracking-[0.35em] uppercase text-[#C5A059]"
            style={{
              fontSize: size === 'sm' ? '8px' : size === 'md' ? '10px' : size === 'lg' ? '13px' : '16px',
            }}
          >
            MASTER
          </span>
          <span className="h-[1px] w-3 bg-[#C5A059]/70" />
        </div>
      </div>
    </div>
  );
};

export default Logo;
