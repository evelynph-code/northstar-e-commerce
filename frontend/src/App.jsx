import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthProvider.jsx'
import { CartProvider } from './context/CartProvider.jsx'
import AdminPage from './pages/AdminPage.jsx'
import AuthPage from './pages/AuthPage.jsx'
import AccountPage from './pages/AccountPage.jsx'
import CartPage from './pages/CartPage.jsx'
import CheckoutPage from './pages/CheckoutPage.jsx'
import ProductDetailPage from './pages/ProductDetailPage.jsx'
import StorePage from './pages/StorePage.jsx'

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<StorePage />} path="/" />
            <Route element={<ProductDetailPage />} path="/products/:productId" />
            <Route element={<CartPage />} path="/cart" />
            <Route element={<CheckoutPage />} path="/checkout" />
            <Route element={<AccountPage />} path="/account" />
            <Route element={<AdminPage />} path="/admin" />
            <Route element={<AuthPage mode="login" />} path="/login" />
            <Route element={<AuthPage mode="signup" />} path="/signup" />
            <Route element={<Navigate replace to="/" />} path="*" />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  )
}

export default App
