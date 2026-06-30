interface IconProps {
  name: keyof typeof PATHS
  size?: number
  className?: string
}

const PATHS = {
  home: 'M3 10.5 12 3l9 7.5M5.5 8.5V20a1 1 0 0 0 1 1H9.5v-6h5v6h3a1 1 0 0 0 1-1V8.5',
  calendar: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  table: 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14',
  bracket:
    'M4 5h5M4 11h5M4 17h5M9 5v3a2 2 0 0 0 2 2h2M9 17v-3a2 2 0 0 1 2-2h2M13 11h3a2 2 0 0 1 2 2v0a2 2 0 0 0 2 2h0M13 11h3a2 2 0 0 0 2-2v0a2 2 0 0 1 2-2h0',
  shirt: 'M8 4 4.5 6.5 6 10l2-1v11h8V9l2 1 1.5-3.5L16 4a4 4 0 0 1-8 0Z',
  stadium:
    'M12 5c5 0 9 1.4 9 3.2V16c0 1.8-4 3.2-9 3.2S3 17.8 3 16V8.2C3 6.4 7 5 12 5ZM3 8.2C3 10 7 11.4 12 11.4s9-1.4 9-3.2M8 11v7M16 11v7',
  tv: 'M4 7h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1ZM8 3l4 4 4-4',
  chart: 'M4 20V10M10 20V4M16 20v-8M21 20H3',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm8.5 3a8.4 8.4 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a8.6 8.6 0 0 0-2-1.2L15.7 3h-4l-.4 2.7a8.6 8.6 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a8.4 8.4 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a8.6 8.6 0 0 0 2 1.2l.4 2.7h4l.4-2.7a8.6 8.6 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.06-.4.1-.8.1-1.2Z',
  globe:
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-9 9h18M12 3c2.5 2.4 4 5.6 4 9s-1.5 6.6-4 9c-2.5-2.4-4-5.6-4-9s1.5-6.6 4-9Z',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  pin: 'M12 21s-7-5.8-7-11a7 7 0 0 1 14 0c0 5.2-7 11-7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  whistle: 'M9 8h6l5-2v5l-3.2.8A6 6 0 1 1 9 8Zm0 0V5.5M13 8V6',
  star: 'm12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.3 7.2 18.9l.9-5.4L4.2 9.7l5.4-.8L12 4Z',
  starFill: 'm12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.3 7.2 18.9l.9-5.4L4.2 9.7l5.4-.8L12 4Z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3.5 2',
  back: 'M15 5l-7 7 7 7',
  chevron: 'M6 9l6 6 6-6',
  close: 'M6 6l12 12M18 6L6 18',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-.01 3.99h.02',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4.5h.01M12 11v5',
  download: 'M12 4v11m0 0 4-4m-4 4-4-4M4 19h16',
  external: 'M14 5h5v5M19 5l-8 8M9 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3',
  bolt: 'M13 3 4 14h6l-1 7 9-11h-6l1-7Z',
}

export type IconName = keyof typeof PATHS

// glyphs drawn as dot-strokes need a much fatter stroke to read at small sizes
const STROKE_OVERRIDE: Partial<Record<IconName, number>> = { dots: 3.6 }

export default function Icon({ name, size = 20, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={name === 'starFill' ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={STROKE_OVERRIDE[name] ?? 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
