import { Link } from 'react-router-dom'
import { ImageOff } from 'lucide-react'
import { cardImage, formatScryfallPrice } from '../../api/client'
import type { InventoryItem } from '../../api/types'
import { Badge } from '../ui'

export interface SpotlightCardProps {
  item: InventoryItem
  slug: string
}

/**
 * SpotlightCard — image-forward card used in the storefront spotlight carousel.
 * Flat enterprise styling using design-system tokens and Badge primitive.
 */
export function SpotlightCard({ item, slug }: SpotlightCardProps) {
  const image = cardImage(item.card)
  return (
    <Link
      to={`/s/${slug}/cards/${item.id}`}
      className="group min-w-[14rem] max-w-[18rem] overflow-hidden rounded-card border border-border bg-surface shadow-card transition-colors hover:border-brand-300 xl:min-w-0"
    >
      <div className="grid aspect-[5/7] place-items-center bg-bg p-3">
        {image ? (
          <img src={image} alt={item.card.name} className="max-h-full rounded-btn" />
        ) : (
          <ImageOff aria-hidden className="size-6 text-fg-muted" />
        )}
      </div>
      <div className="border-t border-border p-3">
        <h3 className="line-clamp-2 font-bold leading-snug text-fg group-hover:text-brand-600">
          {item.card.name}
        </h3>
        <p className="mt-1 text-xs text-fg-muted">{item.card.setName ?? item.card.setCode ?? '-'}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge>{item.card.setCode?.toUpperCase() ?? '-'}</Badge>
          <Badge>{item.condition}</Badge>
          <Badge tone={item.isFoil ? 'brand' : 'neutral'}>{item.isFoil ? 'Foil' : 'Nonfoil'}</Badge>
        </div>
        <div className="mt-3">
          <p className="text-xs uppercase text-fg-muted">Market price</p>
          <p className="text-lg font-bold text-fg">
            {formatScryfallPrice(item.card, item.isFoil ? 'foil' : 'nonfoil')}
          </p>
        </div>
      </div>
    </Link>
  )
}

export default SpotlightCard
