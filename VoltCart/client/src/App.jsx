import { Route, Routes } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import HomePage from './pages/HomePage.jsx';
import ProductPage from './pages/ProductPage.jsx';
import CartPage from './pages/CartPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import PaymentPage from './pages/PaymentPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import AddressesPage from './pages/AddressesPage.jsx';
import AddAddressPage from './pages/AddAddressPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';

const guarded = (element) => <ProtectedRoute>{element}</ProtectedRoute>;

export default function App() {
  return (
    <div className="app">
      <Header />
      <main className="app__main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/product/:slug" element={<ProductPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route path="/checkout" element={guarded(<CheckoutPage />)} />
          <Route path="/payment/:orderId" element={guarded(<PaymentPage />)} />
          <Route path="/orders" element={guarded(<OrdersPage />)} />
          <Route path="/addresses" element={guarded(<AddressesPage />)} />
          <Route path="/addresses/new" element={guarded(<AddAddressPage />)} />
          <Route path="/profile" element={guarded(<ProfilePage />)} />

          <Route path="*" element={<div className="page page--center"><h2>Page not found</h2></div>} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
