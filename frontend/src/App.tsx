import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import AuthLayout from './components/layout/AuthLayout'
import AdminLayout from './components/layout/AdminLayout'
import ProtectedRoute from './components/ProtectedRoute'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import StorePage from './pages/StorePage'
import CardDetailsPage from './pages/CardDetailsPage'
import CustomerProfilePage from './pages/CustomerProfilePage'
import StoreAdminPage from './pages/StoreAdminPage'
import ImportRunDetailsPage from './pages/store-admin/ImportRunDetailsPage'
import PlatformAdminPage from './pages/PlatformAdminPage'
import PlatformStoreImportsPage from './pages/PlatformStoreImportsPage'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Full-screen auth flow (no app navbar) */}
            <Route element={<AuthLayout />}>
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<Navigate to="/register/customer" replace />} />
              <Route path="register/owner" element={<RegisterPage accountType="owner" />} />
              <Route path="register/customer" element={<RegisterPage accountType="customer" />} />
            </Route>

            <Route element={<AppLayout />}>
              <Route index element={<HomePage />} />
              <Route path="s/:slug" element={<StorePage />} />
              <Route path="s/:slug/cards/:id" element={<CardDetailsPage />} />
              <Route
                path="s/:slug/account"
                element={
                  <ProtectedRoute>
                    <CustomerProfilePage />
                  </ProtectedRoute>
                }
              />
            </Route>
            {/* Store admin — slug lives on the layout route so the sidebar can build section links */}
            <Route
              path="s/:slug/admin"
              element={
                <ProtectedRoute requireStoreOwner>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<StoreAdminPage />} />
              <Route path="imports/:importId" element={<ImportRunDetailsPage />} />
              <Route path=":section" element={<StoreAdminPage />} />
            </Route>
            {/* Platform admin */}
            <Route
              path="platform/admin"
              element={
                <ProtectedRoute requireSuperAdmin>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<PlatformAdminPage />} />
              <Route path="stores/:slug/imports" element={<PlatformStoreImportsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
