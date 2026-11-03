<!doctype html>
<html lang="en">
<body style="font-family: Arial, sans-serif; color: #0e1f29; line-height: 1.5;">
<h2 style="color:#0d7c6b;margin-bottom:4px">Booking confirmed: {{ $booking->reference }}</h2>
<p>Hi {{ $recipient->name }},</p>
@if($forHost)
<p>{{ $booking->renter->name }} booked your {{ $booking->vehicle->name }}.</p>
@else
<p>Your trip with the {{ $booking->vehicle->name }} is confirmed.</p>
@endif
<ul>
  <li><b>Pick-up:</b> {{ $booking->pickup_at->timezone('Asia/Manila')->format('D, M j, Y g:i A') }}</li>
  <li><b>Return:</b> {{ $booking->return_at->timezone('Asia/Manila')->format('D, M j, Y g:i A') }}</li>
  <li><b>Trip total:</b> ₱{{ number_format($booking->total) }} · <b>Deposit:</b> ₱{{ number_format($booking->security_deposit) }}</li>
  @unless($forHost)
  <li><b>Free cancellation until:</b> {{ $freeUntil }}</li>
  @endunless
</ul>
<p>The signed rental agreement @if(!$forHost && $invoice)and your invoice are @else is @endif attached as a PDF. You can also download @if(!$forHost && $invoice)them @else it @endif any time from your trip page and billing history.</p>
<p>See you on the road,<br>ByaheGo</p>
</body>
</html>
