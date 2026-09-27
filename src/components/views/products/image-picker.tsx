'use client'

// ── ImagePicker — product image field: file upload (click / drag & drop) with
// client-side canvas resize, live preview, Replace/Remove affordances, plus the
// legacy "paste image URL" flow as a secondary collapsible input.
// Visual language mirrors the expense receipt-attachment field (dashed empty
// tile, ImageOff on broken, ghost Remove with X) scaled up for the product form.
//
// Value contract (server parity with POST/PUT /api/products):
//   '' | http(s)://… | data:image/(png|jpe?g|webp|gif|svg+xml);base64,…
// The API rejects values longer than 300,000 chars (isValidImageUrl in
// src/lib/api-utils.ts) — MAX_URI_LENGTH below mirrors that exact cap, and
// validateImageValue() mirrors the scheme check so the user gets feedback
// before submit.

import { useCallback, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { ChevronDown, ImageOff, ImagePlus, Link2, Loader2, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const MAX_URI_LENGTH = 300_000 // mirrors the cap in isValidImageUrl (src/lib/api-utils.ts)

const HTTP_RE = /^https?:\/\/.+/i
const DATA_URI_RE = /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[\s\S]+$/i

/** Same rules as the API (scheme + size cap) → error message or null. */
export function validateImageValue(v: string | null | undefined): string | null {
  const t = (v ?? '').trim()
  if (!t) return null
  if (t.length > MAX_URI_LENGTH) return 'Image too large — max 300KB for data URIs'
  if (!HTTP_RE.test(t) && !DATA_URI_RE.test(t)) return 'Must be an http(s) URL or a data:image URI'
  return null
}

// Encoding ladder: first step whose output fits under the cap wins. Quality
// degrades before dimensions so photos stay sharp as long as possible.
const ENCODE_LADDER = [
  { maxDim: 640, quality: 0.82 },
  { maxDim: 640, quality: 0.6 },
  { maxDim: 512, quality: 0.5 },
  { maxDim: 384, quality: 0.4 },
  { maxDim: 256, quality: 0.35 },
] as const

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|svg)$/i

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('decode'))
    img.src = src
  })
}

function drawToDataUri(img: HTMLImageElement, maxDim: number, quality: number): string | null {
  const w0 = img.naturalWidth
  const h0 = img.naturalHeight
  if (!w0 || !h0) return null
  const scale = Math.min(1, maxDim / Math.max(w0, h0)) // never upscale
  const w = Math.max(1, Math.round(w0 * scale))
  const h = Math.max(1, Math.round(h0 * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#ffffff' // flatten transparency so photos sit right on dark tiles
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}

async function fileToStoredDataUri(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await loadImage(objectUrl)
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('decode')
    for (const step of ENCODE_LADDER) {
      const uri = drawToDataUri(img, step.maxDim, step.quality)
      // the API cap is on string length → measure chars, not bytes
      if (uri && uri.length <= MAX_URI_LENGTH) return uri
    }
    throw new Error('too-large')
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export function ImagePicker({
  value,
  onChange,
  error,
  disabled = false,
  id = 'p-image',
  label = 'Product image',
}: {
  /** Current value: '' | http(s) URL | data:image URI (null treated as empty). */
  value?: string | null
  /** Called with the next value ('' when removed) — wire to RHF setValue. */
  onChange: (next: string) => void
  /** External (form-level) validation message, shown when the picker's own checks pass. */
  error?: string
  disabled?: boolean
  id?: string
  label?: string
}) {
  const current = (value ?? '').trim()
  const [encoding, setEncoding] = useState(false)
  const [pickerError, setPickerError] = useState<string | null>(null)
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  // Pre-open the URL input when editing a product that uses an external URL
  // (data URIs from the picker keep it collapsed — the preview is the source).
  const [urlOpen, setUrlOpen] = useState(() => HTTP_RE.test(current))
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Derived broken state (no setState-in-effect): tracks which src failed.
  const broken = brokenSrc !== null && brokenSrc === current
  const isDataUri = DATA_URI_RE.test(current)
  const ownError = validateImageValue(current)
  const displayError = pickerError ?? ownError ?? error ?? null

  const helperText = encoding
    ? 'Resizing image…'
    : broken
      ? 'Invalid image URL'
      : current
        ? isDataUri
          ? `Uploaded image · ~${Math.max(1, Math.round(current.length / 1024))}KB · shown on POS tiles & lists`
          : 'Using an external image URL — shown on POS tiles & lists'
        : 'JPG, PNG, WebP or GIF · resized to fit 640px, or paste a URL below'

  const openPicker = useCallback(() => {
    if (disabled || encoding) return
    fileInputRef.current?.click()
  }, [disabled, encoding])

  const handleFile = useCallback(
    async (file: File) => {
      if (disabled) return
      setPickerError(null)
      const looksImage = file.type.startsWith('image/') || IMAGE_EXT_RE.test(file.name)
      if (!looksImage) {
        setPickerError('Please choose an image file (JPG, PNG, WebP or GIF)')
        return
      }
      setEncoding(true)
      try {
        const uri = await fileToStoredDataUri(file)
        setBrokenSrc(null)
        onChange(uri)
      } catch (err) {
        setPickerError(
          err instanceof Error && err.message === 'too-large'
            ? 'Image is too large — could not compress it under the 300KB limit'
            : 'Could not read this image file'
        )
      } finally {
        setEncoding(false)
      }
    },
    [disabled, onChange]
  )

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (f) void handleFile(f)
  }

  const onDragOver = (e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    if (!disabled && !encoding) setDragOver(true)
  }
  const onDragLeave = () => setDragOver(false)
  const onDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (disabled || encoding) return
    const f = e.dataTransfer?.files?.[0]
    if (f) void handleFile(f)
  }

  const remove = () => {
    setPickerError(null)
    setBrokenSrc(null)
    onChange('')
  }

  const dragProps = { onDragOver, onDragLeave, onDrop }
  const urlInputValue = isDataUri ? '' : current

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-start gap-3">
        {current && !broken ? (
          <button
            type="button"
            id={id}
            onClick={openPicker}
            aria-label="Replace product image"
            disabled={disabled || encoding}
            {...dragProps}
            className="group relative size-24 shrink-0 overflow-hidden rounded-md border border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            <img
              src={current}
              alt="Product image preview"
              className="size-full object-cover"
              draggable={false}
              onError={() => setBrokenSrc(current)}
            />
            {encoding && (
              <span className="absolute inset-0 flex items-center justify-center bg-background/70">
                <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
              </span>
            )}
            {!encoding && (
              <span className="absolute inset-x-0 bottom-0 hidden items-center justify-center gap-1 bg-background/85 py-0.5 text-[10px] font-medium text-foreground group-focus-visible:flex group-hover:flex">
                <RefreshCw className="size-2.5" aria-hidden /> Replace
              </span>
            )}
          </button>
        ) : (
          <button
            type="button"
            id={id}
            onClick={openPicker}
            aria-label={broken ? 'Replace product image' : 'Upload product image'}
            disabled={disabled || encoding}
            {...dragProps}
            className={`flex size-24 shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-dashed bg-muted/30 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${
              dragOver ? 'border-primary bg-primary/5 text-foreground' : ''
            }`}
          >
            {encoding ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : broken ? (
              <ImageOff className="size-5" aria-hidden />
            ) : (
              <ImagePlus className="size-5" aria-hidden />
            )}
            <span className="text-[10px] leading-none">{dragOver ? 'Drop to upload' : broken ? 'Invalid image' : 'Upload'}</span>
          </button>
        )}

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-h-[28px] items-start justify-between gap-2">
            <p aria-live="polite" className="pt-1 text-[11px] leading-snug text-muted-foreground">
              {helperText}
            </p>
            {current && !encoding && (
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={openPicker}
                  aria-label="Replace product image"
                >
                  <RefreshCw className="size-3" aria-hidden /> Replace
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                  onClick={remove}
                  aria-label="Remove product image"
                >
                  <X className="size-3" aria-hidden /> Remove
                </Button>
              </div>
            )}
          </div>

          {displayError && (
            <p role="alert" className="text-xs text-destructive">
              {displayError}
            </p>
          )}

          <button
            type="button"
            onClick={() => setUrlOpen((o) => !o)}
            aria-expanded={urlOpen}
            aria-controls={`${id}-url`}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            <Link2 className="size-3" aria-hidden />
            {urlOpen ? 'Hide image URL input' : 'or paste image URL'}
            <ChevronDown className={`size-3 transition-transform ${urlOpen ? 'rotate-180' : ''}`} aria-hidden />
          </button>

          {urlOpen && (
            <Input
              id={`${id}-url`}
              type="text"
              inputMode="url"
              spellCheck={false}
              value={urlInputValue}
              onChange={(e) => {
                setPickerError(null)
                setBrokenSrc(null)
                onChange(e.target.value)
              }}
              placeholder={isDataUri ? 'Paste https://… to replace the uploaded image' : 'https://… or data:image…'}
              className="font-mono text-xs"
              autoComplete="off"
              aria-label="Product image URL"
              disabled={disabled}
            />
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileInputChange}
        disabled={disabled || encoding}
      />
    </div>
  )
}
