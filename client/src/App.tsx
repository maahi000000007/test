import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router, Route, Switch } from 'wouter';
import { ThemeProvider } from './components/theme-provider';
import { Toaster } from './components/ui/toaster';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SalesPage from './pages/SalesPage';
import ProductsPage from './pages/ProductsPage';
import CustomersPage from './pages/CustomersPage';
import InventoryPage from './pages/InventoryPage';
import PurchasesPage from './pages/PurchasesPage';
import QuotationsPage from './pages/QuotationsPage';
import ReportsPage from './pages/ReportsPage';
import RMAPage from './pages/RMAPage';
import SuppliersPage from './pages/SuppliersPage';
import SettingsPage from './pages/SettingsPage';
import PCBuilderPage from './pages/PCBuilderPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="pos-theme">
        <AuthProvider>
          <Router>
            <Switch>
              <Route path="/login" component={LoginPage} />
              <ProtectedRoute path="/" component={DashboardPage} />
              <ProtectedRoute path="/sales" component={SalesPage} />
              <ProtectedRoute path="/products" component={ProductsPage} />
              <ProtectedRoute path="/customers" component={CustomersPage} />
              <ProtectedRoute path="/inventory" component={InventoryPage} />
              <ProtectedRoute path="/purchases" component={PurchasesPage} />
              <ProtectedRoute path="/quotations" component={QuotationsPage} />
              <ProtectedRoute path="/reports" component={ReportsPage} />
              <ProtectedRoute path="/rma" component={RMAPage} />
              <ProtectedRoute path="/suppliers" component={SuppliersPage} />
              <ProtectedRoute path="/pc-builder" component={PCBuilderPage} />
              <ProtectedRoute path="/settings" component={SettingsPage} />
            </Switch>
          </Router>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;