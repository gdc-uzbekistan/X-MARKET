import { FloatingAiWidget } from './components/FloatingAiWidget.tsx';
import { Navbar } from './components/Navbar.tsx';
import { StoreProvider, useStore } from './context/StoreContext.tsx';
import { AdminPortal } from './pages/admin/AdminPortal.tsx';
import { RegisterPage, SignInPage } from './pages/AuthPages.tsx';
import { CartPage, CheckoutPage, OrderConfirmationPage } from './pages/CartAndCheckout.tsx';
import { CatalogPage, CategoriesPage, ProductDetailPage } from './pages/CatalogAndCategories.tsx';
import {
  AiAssistantPage,
  CustomerSupportChatPage,
  FavoritesPage,
  NotificationsPage,
  ProfilePage,
  SellerChatPage,
} from './pages/CustomerAccountPages.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { MyOrdersPage, OrderTrackingPage } from './pages/OrdersAndTracking.tsx';

function ToastStack() {
  const { toasts } = useStore();
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 max-w-xs w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-xl shadow-lg border text-xs font-medium pointer-events-auto ${
            t.type === 'error'
              ? 'bg-red-600 text-white border-red-700'
              : t.type === 'success'
              ? 'bg-[#14532D] text-white border-[#0F3D26]'
              : 'bg-white dark:bg-[#121F18] text-slate-900 dark:text-slate-100 border-slate-200 dark:border-[#243B2E]'
          }`}
        >
          {t.title}
        </div>
      ))}
    </div>
  );
}

function AppRouter() {
  const { currentPath } = useStore();

  // Separate secure Admin Portal
  if (currentPath.startsWith('/admin')) {
    return (
      <>
        <ToastStack />
        <AdminPortal />
      </>
    );
  }

  let page = <HomePage />;

  if (currentPath === '/signin') {
    page = <SignInPage />;
  } else if (currentPath === '/register') {
    page = <RegisterPage />;
  } else if (currentPath === '/catalog') {
    page = <CatalogPage />;
  } else if (currentPath.startsWith('/product/')) {
    const id = Number(currentPath.replace('/product/', '').split('/')[0]);
    page = <ProductDetailPage productId={id} />;
  } else if (currentPath === '/categories') {
    page = <CategoriesPage />;
  } else if (currentPath === '/cart') {
    page = <CartPage />;
  } else if (currentPath === '/checkout') {
    page = <CheckoutPage />;
  } else if (currentPath.startsWith('/order-confirmation/')) {
    const num = currentPath.replace('/order-confirmation/', '');
    page = <OrderConfirmationPage orderNumber={num} />;
  } else if (currentPath === '/orders') {
    page = <MyOrdersPage />;
  } else if (currentPath === '/orders/track') {
    page = <OrderTrackingPage />;
  } else if (currentPath.startsWith('/orders/track/')) {
    const num = currentPath.replace('/orders/track/', '');
    page = <OrderTrackingPage initialOrderNumber={num} />;
  } else if (currentPath === '/profile') {
    page = <ProfilePage />;
  } else if (currentPath === '/favorites') {
    page = <FavoritesPage />;
  } else if (currentPath === '/support') {
    page = <CustomerSupportChatPage />;
  } else if (currentPath === '/seller-chat') {
    page = <SellerChatPage />;
  } else if (currentPath === '/ai') {
    page = <AiAssistantPage />;
  } else if (currentPath === '/notifications') {
    page = <NotificationsPage />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9] dark:bg-[#0B120E] text-[#111C16] dark:text-[#EDF4EF]">
      <Navbar />
      <ToastStack />
      {page}
      <FloatingAiWidget />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppRouter />
    </StoreProvider>
  );
}
