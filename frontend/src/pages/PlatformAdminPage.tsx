import { useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  Badge,
  Button,
  buttonVariants,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  LoadingPanel,
  PageHeader,
  Select,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from '../components/ui'
import {
  CheckCircle2,
  RefreshCw,
  Star,
  Store as StoreIcon,
  Users as UsersIcon,
} from 'lucide-react'
import api, { unwrapCollection } from '../api/client'
import type { AdminUser, ScryfallSyncResult, Store } from '../api/types'

export default function PlatformAdminPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [storeName, setStoreName] = useState('')
  const [storeSlug, setStoreSlug] = useState('')
  const [ownerId, setOwnerId] = useState<number | ''>('')
  const [auditStoreSlug, setAuditStoreSlug] = useState('')

  const storesQuery = useQuery({
    queryKey: ['admin-stores'],
    queryFn: async () => {
      const { data } = await api.get('/admin/stores')
      return unwrapCollection<Store>(data)
    },
  })
  const stores = storesQuery.data ?? []

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data } = await api.get('/admin/users')
      return unwrapCollection<AdminUser>(data)
    },
  })
  const users = usersQuery.data ?? []

  const createStore = useMutation({
    mutationFn: async () => {
      await api.post('/admin/stores', {
        name: storeName,
        slug: storeSlug,
        owner: `/api/admin/users/${ownerId}`,
        isActive: true,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-stores'] })
      await queryClient.invalidateQueries({ queryKey: ['stores'] })
      setStoreName('')
      setStoreSlug('')
      setOwnerId('')
    },
  })

  // Featured is a single hero spotlight on the marketplace home: mark one store,
  // which clears any other. Empty → the home hides the featured section.
  const setFeatured = useMutation({
    mutationFn: async ({ id, featured }: { id: number; featured: boolean }) => {
      if (featured) {
        await Promise.all(
          stores
            .filter((s) => s.featured && s.id !== id)
            .map((s) => api.patch(`/admin/stores/${s.id}`, { featured: false })),
        )
      }
      await api.patch(`/admin/stores/${id}`, { featured })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-stores'] })
      await queryClient.invalidateQueries({ queryKey: ['stores'] })
    },
  })

  const syncScryfall = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<ScryfallSyncResult>('/admin/scryfall/sync')
      return data
    },
  })

  const activeStores = stores.filter((store) => store.isActive !== false).length

  return (
    <div className="space-y-8">
      <PageHeader
        title="Platform admin"
        subtitle="Manage tenants, catalog sync, and import audits across the platform."
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={<StoreIcon aria-hidden className="size-5" />}
          label="Total stores"
          value={stores.length}
        />
        <StatCard
          icon={<CheckCircle2 aria-hidden className="size-5" />}
          label="Active stores"
          value={activeStores}
        />
        <StatCard
          icon={<UsersIcon aria-hidden className="size-5" />}
          label="Users"
          value={users.length}
        />
      </section>

      <Card>
        <CardHeader
          title="Scryfall catalog sync"
          subtitle="Downloads oracle_cards bulk data and upserts the global card catalog."
          actions={
            <Button
              variant="primary"
              loading={syncScryfall.isPending}
              onClick={() => syncScryfall.mutate()}
            >
              <RefreshCw aria-hidden className="size-4" />
              {syncScryfall.isPending ? 'Syncing…' : 'Run sync'}
            </Button>
          }
        />
        {(syncScryfall.data || syncScryfall.isError) && (
          <CardBody>
            {syncScryfall.data && (
              <p className="text-sm text-success-700">
                Synced {syncScryfall.data.total} cards ({syncScryfall.data.inserted} inserted,{' '}
                {syncScryfall.data.updated} updated).
              </p>
            )}
            {syncScryfall.isError && (
              <p className="text-sm text-danger-700">Scryfall sync failed.</p>
            )}
          </CardBody>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Create store"
            subtitle="Provision a new tenant and assign an owner."
          />
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Store name"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Acme Cards"
              />
              <Input
                label="Slug"
                value={storeSlug}
                onChange={(e) => setStoreSlug(e.target.value)}
                placeholder="acme-cards"
              />
            </div>
            <Select
              label="Owner"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Select owner</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName} ({user.email})
                </option>
              ))}
            </Select>
            <div className="flex justify-end">
              <Button
                variant="primary"
                loading={createStore.isPending}
                disabled={!storeName || !storeSlug || !ownerId}
                onClick={() => createStore.mutate()}
              >
                Create store
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Store import audit"
            subtitle="Review CSV import runs and processing status for a store."
          />
          <CardBody className="space-y-4">
            <Select
              label="Store"
              value={auditStoreSlug}
              onChange={(event) => setAuditStoreSlug(event.target.value)}
            >
              <option value="">Select store</option>
              {stores.map((store) => (
                <option key={store.id} value={store.slug}>
                  {store.name} /{store.slug}
                </option>
              ))}
            </Select>
            <div className="flex justify-end">
              <Button
                variant="secondary"
                disabled={!auditStoreSlug}
                onClick={() => navigate(`/platform/admin/stores/${auditStoreSlug}/imports`)}
              >
                View imports
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Stores" subtitle={`${stores.length} total`} />
        {storesQuery.isLoading ? (
          <CardBody>
            <LoadingPanel label="Loading stores…" className="border-0 shadow-none" />
          </CardBody>
        ) : storesQuery.isError ? (
          <CardBody>
            <ErrorState
              description="Could not load stores."
              onRetry={() => storesQuery.refetch()}
            />
          </CardBody>
        ) : stores.length === 0 ? (
          <CardBody>
            <EmptyState
              icon={StoreIcon}
              title="No stores yet"
              description="Create your first store to get started."
            />
          </CardBody>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Store</TH>
                <TH>Slug</TH>
                <TH>Status</TH>
                <TH>Featured</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {stores.map((store) => (
                <TR key={store.id}>
                  <TD className="font-medium">{store.name}</TD>
                  <TD className="text-fg-muted">/{store.slug}</TD>
                  <TD>
                    {store.isActive === false ? (
                      <Badge tone="neutral">Inactive</Badge>
                    ) : (
                      <Badge tone="success">Active</Badge>
                    )}
                  </TD>
                  <TD>
                    <Button
                      variant={store.featured ? 'primary' : 'secondary'}
                      size="sm"
                      loading={setFeatured.isPending && setFeatured.variables?.id === store.id}
                      onClick={() => setFeatured.mutate({ id: store.id, featured: !store.featured })}
                      aria-pressed={Boolean(store.featured)}
                    >
                      <Star aria-hidden className={`size-4 ${store.featured ? 'fill-current' : ''}`} />
                      {store.featured ? 'Featured' : 'Feature'}
                    </Button>
                  </TD>
                  <TD className="text-right">
                    <Link
                      to={`/platform/admin/stores/${store.slug}/imports`}
                      className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                    >
                      Imports
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader title="Users" subtitle={`${users.length} total`} />
        {usersQuery.isLoading ? (
          <CardBody>
            <LoadingPanel label="Loading users…" className="border-0 shadow-none" />
          </CardBody>
        ) : usersQuery.isError ? (
          <CardBody>
            <ErrorState
              description="Could not load users."
              onRetry={() => usersQuery.refetch()}
            />
          </CardBody>
        ) : users.length === 0 ? (
          <CardBody>
            <EmptyState icon={UsersIcon} title="No users yet" />
          </CardBody>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Email</TH>
                <TH>Roles</TH>
              </TR>
            </THead>
            <TBody>
              {users.map((user) => (
                <TR key={user.id}>
                  <TD className="font-medium">{user.displayName}</TD>
                  <TD className="text-fg-muted">{user.email}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-1.5">
                      {user.roles.map((role) => (
                        <Badge key={role} tone="brand">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: number
}) {
  return (
    <Card>
      <CardBody className="flex items-center gap-4">
        <span className="flex size-11 items-center justify-center rounded-card bg-brand-50 text-brand-600">
          {icon}
        </span>
        <div>
          <p className="text-sm text-fg-muted">{label}</p>
          <p className="font-display text-2xl font-bold text-fg">{value}</p>
        </div>
      </CardBody>
    </Card>
  )
}
