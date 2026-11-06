<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Rental agreement {{ $booking->reference }}</title>
<style>
  @page { margin: 28mm 18mm 22mm 18mm; }
  body { font-family: 'DejaVu Sans', sans-serif; font-size: 10pt; color: #0e1f29; line-height: 1.45; }
  .brand { color: #0d7c6b; font-size: 18pt; font-weight: bold; }
  .muted { color: #5b6b76; }
  h1 { font-size: 15pt; margin: 6pt 0 2pt; }
  h2 { font-size: 10.5pt; margin: 14pt 0 3pt; color: #0d7c6b; }
  p { margin: 0 0 4pt; }
  table.meta { width: 100%; border-collapse: collapse; margin: 10pt 0; }
  table.meta td { padding: 4pt 6pt; border: 1px solid #d9e0e5; vertical-align: top; }
  table.meta td.k { width: 30%; background: #f3f6f8; font-weight: bold; }
  .sign { margin-top: 18pt; border: 1px solid #0d7c6b; padding: 10pt; }
  .hash { font-size: 7.5pt; word-break: break-all; }
  .footer { position: fixed; bottom: -14mm; left: 0; right: 0; font-size: 7.5pt; color: #5b6b76; text-align: center; }
</style>
</head>
<body>
<div class="footer">ByaheGo rental agreement {{ $booking->reference }} · version {{ $agreement->version }} · document hash {{ substr($agreement->hash, 0, 16) }}…</div>

<div class="brand">ByaheGo</div>
<h1>Rental Agreement</h1>
<p class="muted">Booking {{ $booking->reference }} · version {{ $agreement->version }}</p>

<table class="meta">
  <tr><td class="k">Renter</td><td>{{ $booking->renter->name }}</td></tr>
  <tr><td class="k">Host</td><td>{{ $booking->host->name }}</td></tr>
  <tr><td class="k">Vehicle</td><td>{{ $booking->vehicle->name }}@if($booking->vehicle->plate_number) · {{ $booking->vehicle->plate_number }}@endif</td></tr>
  <tr><td class="k">Trip</td><td>{{ $booking->pickup_at->timezone('Asia/Manila')->format('D, M j, Y g:i A') }} to {{ $booking->return_at->timezone('Asia/Manila')->format('D, M j, Y g:i A') }}</td></tr>
</table>

@foreach($sections as $s)
  <h2>{{ $s['title'] }}</h2>
  @foreach($s['body'] as $line)
    <p>{{ $line }}</p>
  @endforeach
@endforeach

<div class="sign">
  <p><b>Signed electronically by {{ $agreement->signer_name }}</b></p>
  <p>Date and time: {{ $signedAt }} (Philippine time)</p>
  <p>IP address: {{ $agreement->ip ?? 'not recorded' }}</p>
  <p class="hash">Document hash (SHA-256): {{ $agreement->hash }}</p>
  <p class="muted">The hash identifies the exact agreement text above. If a single character changes, the hash changes.</p>
</div>
</body>
</html>
