import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import StorePage from './pages/StorePage'
import StoreAdminPage from './pages/StoreAdminPage'
import PlatformAdminPage from './pages/PlatformAdminPage'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<HomePage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="s/:slug" element={<StorePage />} />
              <Route
                path="s/:slug/admin"
                element={
                  <ProtectedRoute requireStoreOwner>
                    <StoreAdminPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="platform/admin"
                element={
                  <ProtectedRoute requireSuperAdmin>
                    <PlatformAdminPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
