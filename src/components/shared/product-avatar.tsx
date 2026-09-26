'use client'

// ── ProductAvatar — product photo tile with deterministic initials fallback ──
// Used by POS grid, cart lines, product dialog preview and products table.
// If imageUrl is present it renders the image; on load error it falls back to
// the gradient initials tile (same as when no image is set).
import { useState } from 'react'
import { hashColor } from '@/components/views/products/colors'

export function productInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

export function ProductAvatar({
  name,
  sku,
  imageUrl,
  className = 'size-10 rounded-lg',
  textClassName = 'text-[13px]',
}: {
  name: string
  sku?: string
  imageUrl?: string | null
  className?: string
  textClassName?: string
}) {
  const [broken, setBroken] = useState(false)
  const color = hashColor(sku || name)
  const showImage = imageUrl && !broken

  return (
    <span
      aria-hidden
      className={`relative flex shrink-0 select-none items-center justify-center overflow-hidden font-bold tracking-wide text-white shadow-sm ring-1 ring-black/5 ${className}`}
      style={showImage ? undefined : { background: `linear-gradient(135deg, ${color} 0%, ${color}B3 100%)` }}
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          className="size-full object-cover"
          draggable={false}
        />
      ) : (
        <span className={textClassName}>{productInitials(name)}</span>
      )}
    </span>
  )
}
