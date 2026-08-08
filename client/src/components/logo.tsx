import { useId } from 'react'
import { cn } from '@/lib/utils'

// The mark echoes the app's own calorie ring (RingStat) — a swept progress
// ring with a center dot — so the brand identity ties directly to the product.
export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  const gradientId = useId()
  const radius = 12
  const circumference = 2 * Math.PI * radius

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={cn('shrink-0', className)}
      role="img"
      aria-label="FitTrack logo"
    >
      <defs>
        <linearGradient id={gradientId} x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5b9dff" />
          <stop offset="100%" stopColor="#2dd9c4" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="#0e1a30" />
      <circle cx="20" cy="20" r={radius} fill="none" stroke="#26375c" strokeWidth="4" />
      <circle
        cx="20"
        cy="20"
        r={radius}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * 0.3}
        transform="rotate(-90 20 20)"
      />
      <circle cx="20" cy="20" r="3.5" fill={`url(#${gradientId})`} />
    </svg>
  )
}
