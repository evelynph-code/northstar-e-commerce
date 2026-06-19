import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthProvider.jsx'
import AuthPage from './pages/AuthPage.jsx'
import StorePage from './pages/StorePage.jsx'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<StorePage />} path="/" />
          <Route element={<AuthPage mode="login" />} path="/login" />
          <Route element={<AuthPage mode="signup" />} path="/signup" />
          <Route element={<Navigate replace to="/" />} path="*" />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
