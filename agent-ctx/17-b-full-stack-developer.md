# Task 17-b — Product image file upload with client-side resize (ImagePicker)

## What was built
- `src/components/views/products/image-picker.tsx` (NEW): reusable picker wired to react-hook-form via `value`/`onChange` (value = string | null, '' = none). Click/drag-drop 96px dashed tile → hidden `input[accept="image/*"]` → canvas resize (640px max dim, JPEG q0.82, white backdrop) → data URI; quality/dimension ladder (640/0.6 → 512/0.5 → 384/0.4 → 256/0.35) re-encodes until `uri.length <= 300_000` (exact API cap from `isValidImageUrl`); inline role=alert errors (non-image, decode fail, cannot-fit); live preview + Replace overlay + ghost Replace/Remove buttons; broken-URL → ImageOff tile; collapsible "or paste image URL" input (auto-open when value is http(s), data-URI replace placeholder otherwise); `validateImageValue()` export mirrors server rules.
- `src/components/views/products/product-dialog.tsx`: old `register('imageUrl')` input + ProductAvatar preview replaced with `<ImagePicker value={watch('imageUrl')} onChange={v => setValue('imageUrl', v, {shouldValidate:true, shouldDirty:true})} error={errors.imageUrl?.message} disabled={isSubmitting} />`. Zod rules unchanged (`.max(300_000)` == API cap, no conflict). Payload still `imageUrl: v.imageUrl.trim() || null`.

## Key decisions
- Cap metric: server checks string length (`u.length > 300_000`) → ladder measures chars, not bytes.
- No zod adjustment needed: client max(300_000) === server cap.
- Derived broken-state (`brokenSrc === current`) instead of setState-in-effect (lint rule).
- URL input never holds a 300k data URI: shows empty + replace-placeholder when value is a data URI.

## Verification (all green)
- lint (my files): 0 errors / 1 pre-existing benign RHF warning. tsc: 0 src errors. (Global lint has 1 error in pos/shift-bar.tsx owned by concurrent agent 17-a.)
- E2E agent-browser: 2.1MB in-page PNG → 640×480 JPEG data URI 15,591 chars → preview → Save → persisted via GET; ftp://x → instant inline error; tiny PNG via URL paste → persisted; Remove → Save → null; text file → inline error; synthetic drop event → resized preview; STA-001 prefill OK; Escape-cancels leave data untouched; 390px scrollWidth = 390; screenshots /tmp/qa-product-image-upload.png + -mobile.png; dev.log all 200s.
- Demo data net zero: Ballpoint Pen Pack (10) restored to imageUrl null.

## Constraints / limitations
- Data-URI storage only (≤300KB), no server file storage; GIF animates/SVG alpha lost in JPEG export; EXIF orientation relies on browser auto-orientation.
