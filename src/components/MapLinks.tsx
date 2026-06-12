/** Google Maps + Apple Maps links shown as the official app icons
 * (sourced from Wikimedia Commons; trademarks of Google/Apple, used only to
 * identify links to their services — see COPYRIGHT.md). */
export default function MapLinks({
  query,
  size = 18,
  wiki,
}: {
  query: string
  size?: number
  wiki?: { url: string; title: string }
}) {
  const q = encodeURIComponent(query)
  return (
    <span className="maplinks">
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${q}`}
        target="_blank"
        rel="noreferrer"
        title="Google Maps"
        aria-label="Google Maps"
      >
        <img src="/icons/gmaps.png" alt="Google Maps" width={size} height={size} loading="lazy" />
      </a>
      <a
        href={`https://maps.apple.com/?q=${q}`}
        target="_blank"
        rel="noreferrer"
        title="Apple Maps"
        aria-label="Apple Maps"
      >
        <img src="/icons/amaps.png" alt="Apple Maps" width={size} height={size} loading="lazy" />
      </a>
      {wiki && (
        <a href={wiki.url} target="_blank" rel="noreferrer" title={wiki.title} aria-label={wiki.title}>
          <img src="/icons/wikipedia.png" alt="Wikipedia" width={size} height={size} loading="lazy" />
        </a>
      )}
    </span>
  )
}
