import { useEffect, useMemo, useState, type ImgHTMLAttributes } from 'react'
import { ImageOff } from 'lucide-react'
import { clsx } from 'clsx'

/**
 * A stored picture that says so when it can't be shown.
 *
 * Pictures come from media.al-telegraph.com, which is Cloudflare in front of
 * R2, a different road from the admin and the API (both Railway). When that
 * road fails for someone — a Cloudflare incident, or their provider's route to
 * it — every <img> goes blank while everything else keeps working, and a
 * picture that has just uploaded looks as if it never did. That happened on
 * 2026-11-14: thirty uploads all saved, and the editor looked broken.
 *
 * So: try the given size, then the fallback (the original, for pictures whose
 * renditions are missing), then show a placeholder that says the picture is
 * saved, and keep asking again on a backoff and whenever the browser comes
 * back online.
 */

// After these the picture waits for the browser to report it is back online.
const RETRY_DELAYS = [3_000, 10_000, 30_000, 60_000, 120_000]

interface MediaImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError' | 'children'> {
  src: string
  /** Asked for once `src` fails: the original, when `src` is a rendition. */
  fallbackSrc?: string
  /** Icon only, for avatars and other boxes too small for words. */
  compact?: boolean
  failedLabel?: string
}

export default function MediaImage({
  src,
  fallbackSrc,
  compact = false,
  failedLabel = 'محفوظة — تعذّر عرض المعاينة',
  className,
  alt = '',
  ...img
}: MediaImageProps) {
  const sources = useMemo(
    () => [src, fallbackSrc].filter((s, i, all): s is string => !!s && all.indexOf(s) === i),
    [src, fallbackSrc]
  )
  const [which, setWhich] = useState(0)
  const [failed, setFailed] = useState(false)
  // Bumping it remounts the <img>, which makes the browser ask again.
  const [round, setRound] = useState(0)

  useEffect(() => {
    setWhich(0)
    setFailed(false)
    setRound(0)
  }, [src, fallbackSrc])

  useEffect(() => {
    if (!failed) return
    const retry = () => {
      setWhich(0)
      setFailed(false)
      setRound((r) => r + 1)
    }
    const delay = RETRY_DELAYS[round]
    const timer = delay === undefined ? undefined : window.setTimeout(retry, delay)
    window.addEventListener('online', retry)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('online', retry)
    }
  }, [failed, round])

  if (failed || !sources.length) {
    return (
      <span
        role="img"
        aria-label={failedLabel}
        title={failedLabel}
        className={clsx(
          className,
          'flex flex-col items-center justify-center gap-1 text-center',
          'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500',
          !compact && 'min-h-[4rem]'
        )}
      >
        <ImageOff className={compact ? 'w-4 h-4' : 'w-6 h-6'} aria-hidden="true" />
        {!compact && <span className="text-[11px] leading-tight px-2">{failedLabel}</span>}
      </span>
    )
  }

  return (
    <img
      {...img}
      key={`${round}:${which}`}
      src={sources[which]}
      alt={alt}
      className={className}
      onError={() => {
        if (which < sources.length - 1) setWhich(which + 1)
        else setFailed(true)
      }}
    />
  )
}
