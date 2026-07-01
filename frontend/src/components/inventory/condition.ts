/** Card condition grades (best → worst) and their human-readable labels. */
export const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'] as const

export type Condition = (typeof CONDITIONS)[number]

export const CONDITION_LABELS: Record<Condition, string> = {
  NM: 'Near Mint',
  LP: 'Lightly Played',
  MP: 'Moderately Played',
  HP: 'Heavily Played',
  DMG: 'Damaged',
}
