/** 軽量なインラインSVGアイコン群（currentColor で着色） */
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const base = (props: IconProps) => ({
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props,
})

export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const EnvelopeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="M3.5 7l8.5 6 8.5-6" />
  </svg>
)

export const TextIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 6h14M5 12h14M5 18h9" />
  </svg>
)

export const ImageIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <circle cx="8.5" cy="9.5" r="1.6" />
    <path d="M4 17l4.5-4.5 4 4L16 13l4 4" />
  </svg>
)

export const VideoIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="6" width="13" height="12" rx="2.5" />
    <path d="M16 10l5-3v10l-5-3z" />
  </svg>
)

export const AudioIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
)

export const LinkIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
  </svg>
)

export const CloseIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export const BackIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
)

export const LocateIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22" />
  </svg>
)

export const ListIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M8 6h12M8 12h12M8 18h12" />
    <circle cx="4" cy="6" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="4" cy="12" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="4" cy="18" r="1.1" fill="currentColor" stroke="none" />
  </svg>
)

export const LockIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="5" y="11" width="14" height="9" rx="2.4" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
)

export const TrashIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13" />
  </svg>
)

export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 12l4.5 4.5L19 7" />
  </svg>
)

export const PinIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.4" />
  </svg>
)

export const FlagIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 21V4M5 5h11l-2 3 2 3H5" />
  </svg>
)

/** 伝書鳩（はばたく鳩）。塗りつぶしのシルエットで、ことづての象徴に使う。 */
export const PigeonIcon = (p: IconProps) => (
  <svg
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
    aria-hidden
    {...p}
  >
    <path d="M2.4 12.6c3.7.2 6-1 7.9-3.4 1.2-1.5 2.3-3.2 4.6-3.6.2-1 .9-1.8 1.9-2.1.3-.1.6.2.5.5-.2.6-.1 1 .2 1.4l3.4.6c.4.1.5.5.2.8-1 1.1-2.3 1.6-3.8 1.5-.2 2.9-1.6 5.2-3.9 6.4l.9 3.1c.1.4-.2.7-.6.6l-3-.9c-1 .5-2.1.8-3.3.8-.2.7-.7 1.3-1.4 1.6-.3.1-.7-.1-.6-.5.1-.5 0-.9-.3-1.3-2.3-.6-4-2.2-4.8-4.4-.2-.5.2-1 .7-.9.6.1 1.1 0 1.6-.2-1.1-.4-2-1.2-2.6-2.3-.2-.4.1-.9.6-.9z" />
    <circle cx="16.7" cy="6.6" r="0.7" fill="#fff" />
  </svg>
)

export const BellIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

