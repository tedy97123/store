import { Input } from '../../../components/ui'
import type { GeocodeSuggestion } from '../../../api/types'
import AddressAutocomplete from '../AddressAutocomplete'
import type { OnboardingData, Patch, PatchAddress } from '../types'

export function AddressStep({
  data,
  patch,
  patchAddress,
  applyAddress,
}: {
  data: OnboardingData
  patch: Patch
  patchAddress: PatchAddress
  applyAddress: (s: GeocodeSuggestion) => void
}) {
  const a = data.address
  return (
    <div className="max-w-2xl space-y-5">
      <AddressAutocomplete onSelect={applyAddress} country={a.country || undefined} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input label="Address line 1" value={a.addressLine1} onChange={(e) => patchAddress({ addressLine1: e.target.value })} required />
        </div>
        <div className="sm:col-span-2">
          <Input label="Address line 2" hint="Suite, unit, floor (optional)" value={a.addressLine2} onChange={(e) => patchAddress({ addressLine2: e.target.value })} />
        </div>
        <Input label="City" value={a.city} onChange={(e) => patchAddress({ city: e.target.value })} required />
        <Input label="State / region" value={a.region} onChange={(e) => patchAddress({ region: e.target.value })} />
        <Input label="Postal code" value={a.postalCode} onChange={(e) => patchAddress({ postalCode: e.target.value })} required />
        <Input label="Country" hint="2-letter code, e.g. US" maxLength={2} value={a.country} onChange={(e) => patchAddress({ country: e.target.value.toUpperCase() })} required />
        <div className="sm:col-span-2">
          <Input label="Business phone" type="tel" autoComplete="tel" value={data.phone} onChange={(e) => patch({ phone: e.target.value })} />
        </div>
      </div>
    </div>
  )
}

export default AddressStep
