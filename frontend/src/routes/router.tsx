import type { ComponentType } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'
import { PageLoader } from '@/components/common/States'
import AccountLayout from '@/layouts/AccountLayout'
import AuthLayout from '@/layouts/AuthLayout'
import CheckoutLayout from '@/layouts/CheckoutLayout'
import FocusLayout from '@/layouts/FocusLayout'
import MainLayout from '@/layouts/MainLayout'
import PrintLayout from '@/layouts/PrintLayout'
import RootLayout from '@/layouts/RootLayout'
import HomePage from '@/pages/public/HomePage'
import NotFoundPage from '@/pages/public/NotFoundPage'
import { GuestOnly, RequireAuth } from './guards'

/** Code-split a page: its JavaScript loads only when the route is visited. */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await load()).default })

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    hydrateFallbackElement: <PageLoader />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { index: true, element: <HomePage />, handle: { title: 'Car rental in Cebu' } },
          { path: 'vehicles', lazy: page(() => import('@/pages/public/BrowsePage')), handle: { title: 'Browse vehicles' } },
          { path: 'vehicles/map', lazy: page(() => import('@/pages/public/MapPage')), handle: { title: 'Live availability map' } },
          { path: 'vehicles/:id', lazy: page(() => import('@/pages/public/VehicleDetailPage')), handle: { title: 'Vehicle details' } },
          { path: 'how-it-works', lazy: page(() => import('@/pages/public/HowItWorksPage')), handle: { title: 'How it works' } },
          { path: 'become-a-host', lazy: page(() => import('@/pages/public/BecomeHostPage')), handle: { title: 'List your vehicle' } },
          { path: 'about', lazy: page(() => import('@/pages/public/AboutPage')), handle: { title: 'About us' } },
          { path: 'help', lazy: page(() => import('@/pages/public/HelpPage')), handle: { title: 'Help center' } },
          { path: 'terms', lazy: page(() => import('@/pages/public/TermsPage')), handle: { title: 'Rental agreement & terms' } },
          { path: 'privacy', lazy: page(() => import('@/pages/public/PrivacyPage')), handle: { title: 'Privacy policy' } },
          {
            path: 'account',
            element: <RequireAuth />,
            children: [
              {
                element: <AccountLayout />,
                children: [
                  { index: true, element: <Navigate to="profile" replace /> },
                  { path: 'profile', lazy: page(() => import('@/pages/account/ProfilePage')), handle: { title: 'Profile & settings' } },
                  { path: 'trips', lazy: page(() => import('@/pages/account/TripsPage')), handle: { title: 'My trips' } },
                  { path: 'trips/:reference', lazy: page(() => import('@/pages/account/TripDetailPage')), handle: { title: 'Trip details' } },
                  { path: 'saved', lazy: page(() => import('@/pages/account/SavedPage')), handle: { title: 'Saved vehicles' } },
                  { path: 'recently-viewed', lazy: page(() => import('@/pages/account/RecentlyViewedPage')), handle: { title: 'Recently viewed' } },
                  { path: 'billing', lazy: page(() => import('@/pages/account/BillingPage')), handle: { title: 'Payments & billing' } },
                  { path: 'notifications', lazy: page(() => import('@/pages/account/NotificationsPage')), handle: { title: 'Notifications' } },
                  { path: 'host-application', lazy: page(() => import('@/pages/account/HostApplicationPage')), handle: { title: 'Become a host' } },
                ],
              },
            ],
          },
          { path: '*', element: <NotFoundPage />, handle: { title: 'Page not found' } },
        ],
      },
      {
        element: <GuestOnly />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: 'login', lazy: page(() => import('@/pages/auth/LoginPage')), handle: { title: 'Log in' } },
              { path: 'register', lazy: page(() => import('@/pages/auth/RegisterPage')), handle: { title: 'Create your account' } },
            ],
          },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <CheckoutLayout />,
            children: [
              { path: 'checkout/:vehicleId', lazy: page(() => import('@/pages/checkout/CheckoutPage')), handle: { title: 'Confirm and pay', step: 1 } },
              { path: 'booking/:reference/confirmed', lazy: page(() => import('@/pages/checkout/BookingConfirmedPage')), handle: { title: 'You\'re all set', step: 3 } },
            ],
          },
          {
            element: <FocusLayout />,
            children: [{ path: 'verify', lazy: page(() => import('@/pages/verification/VerifyPage')), handle: { title: 'Verify your identity' } }],
          },
          {
            element: <PrintLayout />,
            children: [{ path: 'invoice/:reference', lazy: page(() => import('@/pages/account/InvoicePage')), handle: { title: 'Invoice & official receipt' } }],
          },
        ],
      },
      {
        path: 'host',
        element: <RequireAuth roles={['host', 'admin']} />,
        children: [
          {
            lazy: page(() => import('@/layouts/HostLayout')),
            children: [
              { index: true, lazy: page(() => import('@/pages/host/HostDashboardPage')), handle: { title: 'Dashboard', subtitle: 'Welcome to hosting' } },
              { path: 'vehicles', lazy: page(() => import('@/pages/host/HostVehiclesPage')), handle: { title: 'Vehicles', subtitle: 'Your listings' } },
              { path: 'vehicles/new', lazy: page(() => import('@/pages/host/HostVehicleFormPage')), handle: { title: 'Add a vehicle', subtitle: 'List your car in 5 quick steps' } },
              { path: 'vehicles/:id/edit', lazy: page(() => import('@/pages/host/HostVehicleFormPage')), handle: { title: 'Edit vehicle', subtitle: 'Update your listing' } },
              { path: 'bookings', lazy: page(() => import('@/pages/host/HostBookingsPage')), handle: { title: 'Bookings', subtitle: 'Trips for your vehicles' } },
              { path: 'bookings/:reference', lazy: page(() => import('@/pages/host/HostBookingDetailPage')), handle: { title: 'Booking details', subtitle: 'Handover, return and incidents' } },
              { path: 'earnings', lazy: page(() => import('@/pages/host/HostEarningsPage')), handle: { title: 'Earnings', subtitle: 'Payouts and monthly income' } },
            ],
          },
        ],
      },
      {
        path: 'admin',
        element: <RequireAuth roles={['admin']} />,
        children: [
          {
            lazy: page(() => import('@/layouts/AdminLayout')),
            children: [
              { index: true, lazy: page(() => import('@/pages/admin/AdminOverviewPage')), handle: { title: 'Overview', subtitle: 'ByaheGo admin console' } },
              { path: 'bookings', lazy: page(() => import('@/pages/admin/AdminBookingsPage')), handle: { title: 'Bookings', subtitle: 'Every rental across the platform' } },
              { path: 'bookings/:reference', lazy: page(() => import('@/pages/admin/AdminBookingDetailPage')), handle: { title: 'Booking details' } },
              { path: 'payments', lazy: page(() => import('@/pages/admin/AdminPaymentsPage')), handle: { title: 'Payments & refunds', subtitle: 'Charges, refunds and fees' } },
              { path: 'payouts', lazy: page(() => import('@/pages/admin/AdminPayoutsPage')), handle: { title: 'Payouts', subtitle: 'Host earnings to send' } },
              { path: 'verifications', lazy: page(() => import('@/pages/admin/AdminVerificationsPage')), handle: { title: 'ID verifications', subtitle: 'Review driver\'s licenses' } },
              { path: 'verifications/:id', lazy: page(() => import('@/pages/admin/AdminVerificationDetailPage')), handle: { title: 'Review license' } },
              { path: 'listings', lazy: page(() => import('@/pages/admin/AdminListingsPage')), handle: { title: 'Listings', subtitle: 'Approve vehicles before they go live' } },
              { path: 'listings/:id', lazy: page(() => import('@/pages/admin/AdminListingDetailPage')), handle: { title: 'Review listing' } },
              { path: 'host-applications', lazy: page(() => import('@/pages/admin/AdminHostApplicationsPage')), handle: { title: 'Host applications', subtitle: 'People who want to list vehicles' } },
              { path: 'disputes', lazy: page(() => import('@/pages/admin/AdminDisputesPage')), handle: { title: 'Disputes', subtitle: 'Damage, theft and trip incidents' } },
              { path: 'users', lazy: page(() => import('@/pages/admin/AdminUsersPage')), handle: { title: 'Users', subtitle: 'Renters, hosts and admins' } },
              { path: 'users/:id', lazy: page(() => import('@/pages/admin/AdminUserDetailPage')), handle: { title: 'User details' } },
              { path: 'support', lazy: page(() => import('@/pages/admin/AdminSupportPage')), handle: { title: 'Support inbox', subtitle: 'Messages from customers' } },
              { path: 'settings', lazy: page(() => import('@/pages/admin/AdminSettingsPage')), handle: { title: 'Settings', subtitle: 'Fees and policies' } },
            ],
          },
        ],
      },
    ],
  },
])
