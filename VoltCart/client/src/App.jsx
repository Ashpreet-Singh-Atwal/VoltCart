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
import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx';
import AdminProductFormPage from './pages/admin/AdminProductFormPage.jsx';
import AdminSalesPage from './pages/admin/AdminSalesPage.jsx';
import AdminSaleFormPage from './pages/admin/AdminSaleFormPage.jsx';

const guarded = (element) => <ProtectedRoute>{element}</ProtectedRoute>;
const buyerOnly = (element) => <ProtectedRoute role="BUYER">{element}</ProtectedRoute>;
const adminOnly = (element) => <ProtectedRoute role="ADMIN">{element}</ProtectedRoute>;

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

          <Route path="/checkout" element={buyerOnly(<CheckoutPage />)} />
          <Route path="/payment/:orderId" element={buyerOnly(<PaymentPage />)} />
          <Route path="/orders" element={buyerOnly(<OrdersPage />)} />
          <Route path="/addresses" element={buyerOnly(<AddressesPage />)} />
          <Route path="/addresses/new" element={buyerOnly(<AddAddressPage />)} />
          <Route path="/profile" element={guarded(<ProfilePage />)} />

          <Route path="/admin" element={adminOnly(<AdminDashboardPage />)} />
          <Route path="/admin/products/new" element={adminOnly(<AdminProductFormPage />)} />
          <Route path="/admin/products/:productId/edit" element={adminOnly(<AdminProductFormPage />)} />
          <Route path="/admin/sales" element={adminOnly(<AdminSalesPage />)} />
          <Route path="/admin/sales/new" element={adminOnly(<AdminSaleFormPage />)} />
          <Route path="/admin/sales/:saleId/edit" element={adminOnly(<AdminSaleFormPage />)} />

          <Route path="*" element={<div className="page page--center"><h2>Page not found</h2></div>} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
