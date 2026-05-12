interface IconProps {
  name:
    | 'sun'
    | 'moon'
    | 'monitor'
    | 'arrow-right'
    | 'arrow-left'
    | 'check'
    | 'github'
    | 'bitbucket'
    | 'download'
    | 'package'
    | 'code'
    | 'wand'
    | 'folder'
    | 'file'
    | 'file-text'
    | 'sparkles'
    | 'mouse-pointer'
    | 'copilot'
    | 'thumbs-up'
    | 'thumbs-down'
    | 'loader';
  size?: number;
  className?: string;
}

export function Icon({ name, size = 16, className }: IconProps): JSX.Element | null {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className,
    style: { display: 'block' as const, flexShrink: 0 },
  };
  switch (name) {
    case 'sun':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      );
    case 'moon':
      return (
        <svg {...props}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      );
    case 'monitor':
      return (
        <svg {...props}>
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      );
    case 'arrow-right':
      return (
        <svg {...props}>
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      );
    case 'arrow-left':
      return (
        <svg {...props}>
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      );
    case 'check':
      return (
        <svg {...props}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case 'github':
      return (
        <svg {...props}>
          <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.4 3.4 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.4 5.4 0 0 0 20 4.77 5 5 0 0 0 19.91 1S18.73.65 16 2.48a13.4 13.4 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5 5 0 0 0 5 4.77a5.4 5.4 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.4 3.4 0 0 0 9 18.13V22" />
        </svg>
      );
    case 'bitbucket':
      return (
        <svg {...props}>
          <path d="M3 3h18l-2.5 18H5.5L3 3z" />
          <path d="M10 9h4l-.5 6h-3L10 9z" />
        </svg>
      );
    case 'download':
      return (
        <svg {...props}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      );
    case 'package':
      return (
        <svg {...props}>
          <path d="M16.5 9.4 7.55 4.24" />
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );
    case 'code':
      return (
        <svg {...props}>
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      );
    case 'wand':
      return (
        <svg {...props}>
          <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M15 9h0M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5" />
        </svg>
      );
    case 'folder':
      return (
        <svg {...props}>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'file':
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    case 'file-text':
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
      );
    case 'sparkles':
      return (
        <svg {...props}>
          <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
          <path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9z" />
          <path d="M5 3l.6 1.4L7 5l-1.4.6L5 7l-.6-1.4L3 5l1.4-.6z" />
        </svg>
      );
    case 'mouse-pointer':
      return (
        <svg {...props}>
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51z" />
          <path d="M13 13l6 6" />
        </svg>
      );
    case 'copilot':
      return (
        <svg {...props}>
          <path d="M12 3c2.5 0 4 1.5 4 4v1h1a4 4 0 0 1 4 4v1a4 4 0 0 1-3 3.87V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-2.13A4 4 0 0 1 3 13v-1a4 4 0 0 1 4-4h1V7c0-2.5 1.5-4 4-4z" />
          <circle cx="9.5" cy="13" r="0.8" />
          <circle cx="14.5" cy="13" r="0.8" />
        </svg>
      );
    case 'thumbs-up':
      return (
        <svg {...props}>
          <path d="M7 22V11" />
          <path d="M14 2v6h6l-3 11a2 2 0 0 1-2 1.5H7V11l5-9a3 3 0 0 1 2 0z" />
        </svg>
      );
    case 'thumbs-down':
      return (
        <svg {...props}>
          <path d="M17 2v11" />
          <path d="M10 22v-6H4l3-11a2 2 0 0 1 2-1.5h8V13l-5 9a3 3 0 0 1-2 0z" />
        </svg>
      );
    case 'loader':
      return (
        <svg {...props}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      );
    default:
      return null;
  }
}
