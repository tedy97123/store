import { Link } from 'react-router-dom'
import { ImageOff } from 'lucide-react'
import { cardImage, formatScryfallPrice } from '../../api/client'
import type { InventoryItem } from '../../api/types'
import { Badge } from '../ui'

export interface CardTileProps {
  item: InventoryItem
  slug: string
}

/**
 * CardTile — list-style storefront result card (image + meta + price footer).
 * Flat enterprise styling using design-system tokens and Badge primitive.
 */
export function CardTile({ item, slug }: CardTileProps) {
  const image = cardImage(item.card)
  return (
    <Link
      to={`/s/${slug}/cards/${item.id}`}
      className="group flex flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card transition-colors hover:border-brand-300"
    >
      <div className="flex gap-4 p-4">
        <div className="grid h-36 w-24 flex-shrink-0 place-items-center rounded-card border border-border bg-bg">
          {image ? (
            <img src={image} alt={item.card.name} className="max-h-32 rounded-btn" />
          ) : (
            <ImageOff aria-hidden className="size-6 text-fg-muted" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 font-bold leading-snug text-brand-600">{item.card.name}</h3>
          <p className="mt-1 line-clamp-2 text-xs text-fg-muted">{item.card.typeLine}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge>{item.card.setCode?.toUpperCase() ?? '-'}</Badge>
            <Badge>{item.condition}</Badge>
            <Badge tone={item.isFoil ? 'brand' : 'neutral'}>{item.isFoil ? 'Foil' : 'Nonfoil'}</Badge>
          </div>
        </div>
      </div>
      <div className="mt-auto border-t border-border bg-bg px-4 py-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs text-fg-muted">{item.card.setName ?? 'Unknown set'}</p>
            <p className="text-xs font-medium text-fg-muted">{item.quantity} available</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase text-fg-muted">Market price</p>
            <p className="text-xl font-bold text-fg">
              {formatScryfallPrice(item.card, item.isFoil ? 'foil' : 'nonfoil')}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default CardTile
