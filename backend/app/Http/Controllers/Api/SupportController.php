<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SupportTicket;
use App\Support\Notifier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class SupportController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'email' => ['required', 'email'],
            'topic' => ['required', Rule::in(['booking', 'payment', 'refund', 'verification', 'hosting', 'safety', 'other'])],
            'booking_reference' => ['nullable', 'string', 'max:20'],
            'message' => ['required', 'string', 'min:10', 'max:3000'],
        ], ['message.min' => 'Please give us a few more details so we can help.']);
        $ticket = SupportTicket::create($data + ['user_id' => Auth::guard('sanctum')->id()]);
        Notifier::admins('New support message', "{$data['name']}: {$data['topic']}", '/admin/support', 'info');
        return response()->json(['id' => $ticket->id, 'message' => 'Thanks! Our support team will reply to your email within a few hours.'], 201);
    }
}
