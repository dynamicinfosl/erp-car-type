import React, { lazy } from 'react';
import { RouteObject, Navigate } from 'react-router-dom';

const Login = lazy(() => import('../pages/auth/login'));
const Register = lazy(() => import('../pages/auth/register'));
const Home = lazy(() => import('../pages/home/page'));
const Dashboard = lazy(() => import('../pages/dashboard/page'));
const Inbox = lazy(() => import('../pages/inbox/page'));
const Appointments = lazy(() => import('../pages/appointments/page'));
const ServiceOrders = lazy(() => import('../pages/service-orders/page'));
const Customers = lazy(() => import('../pages/customers/page'));
const Products = lazy(() => import('../pages/products/page'));
const Services = lazy(() => import('../pages/services/page'));
const Stock = lazy(() => import('../pages/stock/page'));
const Sales = lazy(() => import('../pages/sales/page'));
const Returns = lazy(() => import('../pages/sales/returns/page'));
const Reports = lazy(() => import('../pages/reports/page'));
const ProductSalesReport = lazy(() => import('../pages/reports/product-sales/page'));
const Receivables = lazy(() => import('../pages/financial/receivables/page'));
const Payables = lazy(() => import('../pages/financial/payables/page'));
const CashFlow = lazy(() => import('../pages/financial/cash-flow/page'));
const FinancialOverview = lazy(() => import('../pages/financial/overview/page'));
const POS = lazy(() => import('../pages/pos/page'));
const UsersSettings = lazy(() => import('../pages/settings/users/page'));
const CompanySettings = lazy(() => import('../pages/settings/company/page'));
const PrintServiceOrder = lazy(() => import('../pages/print/service-order'));
const POSReceipt = lazy(() => import('../pages/print/pos-receipt'));
const SaleReceipt = lazy(() => import('../pages/print/sale-receipt'));
const NoAccess = lazy(() => import('../pages/no-access/page'));
const NotFound = lazy(() => import('../pages/NotFound'));

const routes: RouteObject[] = [
  {
    path: '/',
    element: <Navigate to="/auth/login" replace />,
  },
  {
    path: '/auth/login',
    element: <Login />,
  },
  {
    path: '/auth/register',
    element: <Register />,
  },
  {
    path: '/dashboard',
    element: <Dashboard />,
  },
  {
    path: '/inbox',
    element: <Inbox />,
  },
  {
    path: '/appointments',
    element: <Appointments />,
  },
  {
    path: '/service-orders',
    element: <ServiceOrders />,
  },
  {
    path: '/customers',
    element: <Customers />,
  },
  {
    path: '/products',
    element: <Products />,
  },
  {
    path: '/services',
    element: <Services />,
  },
  {
    path: '/stock',
    element: <Stock />,
  },
  {
    path: '/sales',
    element: <Sales />,
  },
  {
    path: '/sales/returns',
    element: <Returns />,
  },
  {
    path: '/pos',
    element: <POS />,
  },
  {
    path: '/financial',
    element: <FinancialOverview />,
  },
  {
    path: '/financial/receivables',
    element: <Receivables />,
  },
  {
    path: '/financial/payables',
    element: <Payables />,
  },
  {
    path: '/financial/cash-flow',
    element: <CashFlow />,
  },
  {
    path: '/reports',
    element: <Reports />,
  },
  {
    path: '/reports/product-sales',
    element: <ProductSalesReport />,
  },
  {
    path: '/settings/users',
    element: <UsersSettings />,
  },
  {
    path: '/settings/company',
    element: <CompanySettings />,
  },
  {
    path: '/print/service-order/:id',
    element: <PrintServiceOrder />,
  },
  {
    path: '/print/pos-receipt/:id',
    element: <POSReceipt />,
  },
  {
    path: '/print/sale-receipt/:type/:id',
    element: <SaleReceipt />,
  },
  {
    path: '/no-access',
    element: <NoAccess />,
  },
  {
    path: '/404',
    element: <NotFound />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
];

export default routes;
