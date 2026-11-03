<?php

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\Admin\AdminBookingController;
use App\Http\Controllers\Api\Admin\AdminListingController;
use App\Http\Controllers\Api\Admin\AdminMiscController;
use App\Http\Controllers\Api\Admin\AdminOverviewController;
use App\Http\Controllers\Api\Admin\AdminUserController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\XenditWebhookController;
use App\Http\Controllers\Api\Host\HostBookingController;
use App\Http\Controllers\Api\Host\HostDashboardController;
use App\Http\Controllers\Api\Host\HostVehicleController;
use App\Http\Controllers\Api\HostApplicationController;
use App\Http\Controllers\Api\MediaController;
use App\Http\Controllers\Api\SocialAuthController;
use App\Http\Controllers\Api\SupportController;
use App\Http\Controllers\Api\VehicleController;
use App\Http\Controllers\Api\VerificationController;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => ['ok' => true, 'time' => now()->toIso8601String()]);

// ----- Public -----
Route::prefix('auth')->group(function () {
    Route::post('register', [AuthController::class, 'register'])->middleware('throttle:10,1');
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::post('forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:password-reset');
    Route::post('reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:password-reset');
    Route::get('config', [AuthController::class, 'config']);
    Route::post('social/exchange', [SocialAuthController::class, 'exchange'])->middleware('throttle:15,1');
    Route::post('social/complete', [SocialAuthController::class, 'complete'])->middleware('throttle:10,1');
    Route::get('{provider}/redirect', [SocialAuthController::class, 'redirect'])->where('provider', 'google|facebook');
    Route::get('{provider}/callback', [SocialAuthController::class, 'callback'])->where('provider', 'google|facebook');
});
Route::get('hubs', [VehicleController::class, 'hubs']);
Route::get('stats', [VehicleController::class, 'stats']);
Route::get('vehicles', [VehicleController::class, 'index']);
Route::get('vehicles/map', [VehicleController::class, 'map']);
Route::get('vehicles/{id}', [VehicleController::class, 'show'])->whereNumber('id');
Route::get('vehicles/{id}/reviews', [VehicleController::class, 'reviews'])->whereNumber('id');
Route::post('vehicles/{id}/quote', [VehicleController::class, 'quote'])->whereNumber('id');
Route::get('media/{id}', [MediaController::class, 'show'])->whereNumber('id');
Route::post('support', [SupportController::class, 'store'])->middleware('throttle:6,1');

// ----- Signed in -----
Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::get('me', [AccountController::class, 'me']);
    Route::put('me', [AccountController::class, 'update']);
    Route::put('me/password', [AccountController::class, 'password']);
    Route::put('me/payout', [AccountController::class, 'updatePayout']);
    Route::get('me/notifications', [AccountController::class, 'notifications']);
    Route::post('me/notifications/read-all', [AccountController::class, 'readAllNotifications']);
    Route::post('me/notifications/{id}/read', [AccountController::class, 'readNotification'])->whereNumber('id');
    Route::get('me/billing', [AccountController::class, 'billing']);
    Route::get('me/favorites', [AccountController::class, 'favorites']);
    Route::get('me/favorite-ids', [AccountController::class, 'favoriteIds']);
    Route::post('me/favorites/{vehicle}', [AccountController::class, 'addFavorite']);
    Route::delete('me/favorites/{vehicle}', [AccountController::class, 'removeFavorite']);
    Route::post('me/favorites/{vehicle}/alert', [AccountController::class, 'toggleFavoriteAlert']);
    Route::get('me/recently-viewed', [AccountController::class, 'recentlyViewed']);
    Route::delete('me/recently-viewed', [AccountController::class, 'clearRecentlyViewed']);

    Route::post('media', [MediaController::class, 'store'])->middleware('throttle:60,1');

    Route::get('verification', [VerificationController::class, 'show']);
    Route::post('verification', [VerificationController::class, 'store']);

    Route::get('host-application', [HostApplicationController::class, 'show']);
    Route::post('host-application', [HostApplicationController::class, 'store']);

    Route::get('bookings', [BookingController::class, 'index']);
    Route::post('bookings', [BookingController::class, 'store'])->middleware('throttle:20,1');
    Route::get('bookings/{reference}', [BookingController::class, 'show']);
    Route::post('vehicles/{id}/agreement', [BookingController::class, 'agreementPreview'])->whereNumber('id');
    Route::post('bookings/{reference}/cancel', [BookingController::class, 'cancel']);
    Route::get('bookings/{reference}/agreement.pdf', [BookingController::class, 'agreementPdf']);
    Route::post('bookings/{reference}/verify-payment', [BookingController::class, 'verifyPayment'])->middleware('throttle:60,1');
    Route::post('bookings/{reference}/pay', [BookingController::class, 'pay'])->middleware('throttle:20,1');
    Route::get('payments/{id}/invoice.pdf', [BookingController::class, 'invoicePdf'])->whereNumber('id');
    Route::post('bookings/{reference}/pay-balance', [BookingController::class, 'payBalance']);
    Route::post('bookings/{reference}/review', [BookingController::class, 'review']);
    Route::post('bookings/{reference}/incidents', [BookingController::class, 'reportIncident']);

    // ----- Host -----
    Route::prefix('host')->middleware('role:host,admin')->group(function () {
        Route::get('dashboard', [HostDashboardController::class, 'dashboard']);
        Route::get('earnings', [HostDashboardController::class, 'earnings']);
        Route::get('vehicles', [HostVehicleController::class, 'index']);
        Route::post('vehicles', [HostVehicleController::class, 'store']);
        Route::get('vehicles/{id}', [HostVehicleController::class, 'show'])->whereNumber('id');
        Route::put('vehicles/{id}', [HostVehicleController::class, 'update'])->whereNumber('id');
        Route::delete('vehicles/{id}', [HostVehicleController::class, 'destroy'])->whereNumber('id');
        Route::post('vehicles/{id}/submit', [HostVehicleController::class, 'submit'])->whereNumber('id');
        Route::post('vehicles/{id}/pause', [HostVehicleController::class, 'pause'])->whereNumber('id');
        Route::post('vehicles/{id}/resume', [HostVehicleController::class, 'resume'])->whereNumber('id');
        Route::get('vehicles/{id}/blocked-dates', [HostVehicleController::class, 'blockedDates'])->whereNumber('id');
        Route::post('vehicles/{id}/blocked-dates', [HostVehicleController::class, 'blockDates'])->whereNumber('id');
        Route::delete('vehicles/{id}/blocked-dates/{blockId}', [HostVehicleController::class, 'unblockDates'])->whereNumber(['id', 'blockId']);
        Route::get('bookings', [HostBookingController::class, 'index']);
        Route::get('bookings/{reference}', [HostBookingController::class, 'show']);
        Route::get('bookings/{reference}/agreement.pdf', [HostBookingController::class, 'agreementPdf']);
        Route::post('bookings/{reference}/cancel', [HostBookingController::class, 'cancel']);
        Route::post('bookings/{reference}/pickup', [HostBookingController::class, 'pickup']);
        Route::post('bookings/{reference}/return', [HostBookingController::class, 'return']);
        Route::post('bookings/{reference}/incidents', [HostBookingController::class, 'reportIncident']);
    });

    // ----- Admin -----
    Route::prefix('admin')->middleware('role:admin')->group(function () {
        Route::get('overview', AdminOverviewController::class);
        Route::get('users', [AdminUserController::class, 'index']);
        Route::get('users/{id}', [AdminUserController::class, 'show'])->whereNumber('id');
        Route::post('users/{id}/suspend', [AdminUserController::class, 'suspend'])->whereNumber('id');
        Route::post('users/{id}/revoke', [AdminUserController::class, 'revoke'])->whereNumber('id');
        Route::post('users/{id}/reinstate', [AdminUserController::class, 'reinstate'])->whereNumber('id');
        Route::get('audit-log', [AdminMiscController::class, 'auditLog']);
        Route::post('users/{id}/revoke-verification', [AdminUserController::class, 'revokeVerification'])->whereNumber('id');
        Route::get('verifications', [AdminUserController::class, 'verifications']);
        Route::get('verifications/{id}', [AdminUserController::class, 'verification'])->whereNumber('id');
        Route::post('verifications/{id}/approve', [AdminUserController::class, 'approveVerification'])->whereNumber('id');
        Route::post('verifications/{id}/reject', [AdminUserController::class, 'rejectVerification'])->whereNumber('id');
        Route::post('verifications/{id}/override', [AdminUserController::class, 'overrideVerification'])->whereNumber('id');
        Route::get('host-applications', [AdminUserController::class, 'hostApplications']);
        Route::post('host-applications/{id}/approve', [AdminUserController::class, 'approveHost'])->whereNumber('id');
        Route::post('host-applications/{id}/reject', [AdminUserController::class, 'rejectHost'])->whereNumber('id');
        Route::get('listings', [AdminListingController::class, 'index']);
        Route::get('listings/{id}', [AdminListingController::class, 'show'])->whereNumber('id');
        Route::post('listings/{id}/approve', [AdminListingController::class, 'approve'])->whereNumber('id');
        Route::post('listings/{id}/reject', [AdminListingController::class, 'reject'])->whereNumber('id');
        Route::post('listings/{id}/suspend', [AdminListingController::class, 'suspend'])->whereNumber('id');
        Route::get('bookings', [AdminBookingController::class, 'index']);
        Route::get('bookings/{reference}', [AdminBookingController::class, 'show']);
        Route::get('bookings/{reference}/agreement.pdf', [AdminBookingController::class, 'agreementPdf']);
        Route::post('bookings/{reference}/cancel', [AdminBookingController::class, 'cancel']);
        Route::post('bookings/{reference}/refund', [AdminBookingController::class, 'refund']);
        Route::post('bookings/{reference}/note', [AdminBookingController::class, 'note']);
        Route::post('bookings/{reference}/message', [AdminBookingController::class, 'message']);
        Route::get('payments', [AdminBookingController::class, 'payments']);
        Route::get('payments/{id}/invoice.pdf', [AdminBookingController::class, 'invoicePdf'])->whereNumber('id');
        Route::post('payments/{id}/sync', [AdminBookingController::class, 'syncPayment'])->whereNumber('id');
        Route::post('payments/{id}/retry-refund', [AdminBookingController::class, 'retryRefund'])->whereNumber('id');
        Route::post('payments/{id}/mark-refund-handled', [AdminBookingController::class, 'markRefundHandled'])->whereNumber('id');
        Route::get('payouts', [AdminBookingController::class, 'payouts']);
        Route::post('payouts/{id}/mark-paid', [AdminBookingController::class, 'markPayoutPaid'])->whereNumber('id');
        Route::get('disputes', [AdminBookingController::class, 'incidents']);
        Route::post('disputes/{id}/resolve', [AdminBookingController::class, 'resolveIncident'])->whereNumber('id');
        Route::get('support', [AdminMiscController::class, 'support']);
        Route::post('support/{id}/reply', [AdminMiscController::class, 'replySupport'])->whereNumber('id');
        Route::get('settings', [AdminMiscController::class, 'settings']);
        Route::put('settings', [AdminMiscController::class, 'updateSettings']);
    });
});

// Xendit calls this when a payment page is paid or a refund finishes. It checks its own callback token, not a user login.
Route::post('webhooks/xendit', [XenditWebhookController::class, 'handle'])->middleware('throttle:120,1');
