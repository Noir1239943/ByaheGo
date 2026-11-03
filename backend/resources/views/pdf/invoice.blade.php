<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{ $d['title'] }} {{ $invoice->number }}</title>
<style>
  @page { margin: 22mm 18mm 24mm 18mm; }
  body { font-family: 'DejaVu Sans', sans-serif; font-size: 10pt; color: #0e1f29; line-height: 1.45; }
  .brand { color: #0d7c6b; font-size: 20pt; font-weight: bold; }
  .muted { color: #5b6b76; }
  h1 { font-size: 16pt; margin: 0; text-align: right; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 6pt 6pt; vertical-align: top; }
  .head td { padding: 0; }
  .box { background: #f3f6f8; border: 1px solid #d9e0e5; }
  .box td { padding: 7pt 9pt; }
  .lines { margin-top: 14pt; }
  .lines th { text-align: left; background: #0d7c6b; color: #fff; font-size: 9pt; }
  .lines td { border-bottom: 1px solid #d9e0e5; }
  .r { text-align: right; }
  .total td { font-weight: bold; font-size: 11.5pt; border-top: 2px solid #0e1f29; border-bottom: 0; }
  .paid { display: inline-block; border: 2px solid #0d7c6b; color: #0d7c6b; font-weight: bold; padding: 2pt 8pt; font-size: 10pt; }
  .footer { position: fixed; bottom: -16mm; left: 0; right: 0; font-size: 8pt; color: #5b6b76; text-align: center; }
</style>
</head>
<body>
<div class="footer">{{ $d['note'] }} · {{ $d['seller']['name'] }} · {{ $d['seller']['email'] }}</div>

<table class="head">
  <tr>
    <td><div class="brand">{{ $d['seller']['name'] }}</div><div class="muted">{{ $d['seller']['tagline'] }}</div></td>
    <td><h1>{{ strtoupper($d['title']) }}</h1><div class="r muted">No. {{ $invoice->number }}</div></td>
  </tr>
</table>

<table class="box" style="margin-top:14pt">
  <tr>
    <td style="width:50%">
      <b>Billed to</b><br>
      {{ $d['renter']['name'] }}<br>
      {{ $d['renter']['email'] }}@if(!empty($d['renter']['phone']))<br>{{ $d['renter']['phone'] }}@endif
    </td>
    <td style="width:50%">
      <b>Date</b>: {{ \Carbon\Carbon::parse($d['paid_at'])->timezone('Asia/Manila')->format('M j, Y g:i A') }}<br>
      <b>Booking</b>: {{ $d['booking']['reference'] }}<br>
      <b>Payment method</b>: {{ $d['method'] }}<br>
      <b>Reference</b>: {{ $d['payment_reference'] }}
      @if(!empty($d['original_invoice']))<br><b>Refunds invoice</b>: {{ $d['original_invoice'] }}@endif
    </td>
  </tr>
</table>

<p style="margin-top:12pt"><b>Trip</b>: {{ $d['booking']['vehicle'] }}@if(!empty($d['booking']['plate'])) · {{ $d['booking']['plate'] }}@endif<br>
  <span class="muted">{{ \Carbon\Carbon::parse($d['booking']['pickup_at'])->timezone('Asia/Manila')->format('D, M j, Y g:i A') }} to {{ \Carbon\Carbon::parse($d['booking']['return_at'])->timezone('Asia/Manila')->format('D, M j, Y g:i A') }} ({{ $d['booking']['days'] }} day(s))</span></p>

<table class="lines">
  <tr><th>Description</th><th class="r" style="width:28%">Amount</th></tr>
  @foreach($d['items'] as $item)
    <tr><td>{{ $item['label'] }}</td><td class="r">₱{{ number_format($item['amount']) }}</td></tr>
  @endforeach
  <tr class="total"><td>{{ $invoice->kind === 'invoice' ? 'Total paid' : 'Total refunded' }}</td><td class="r">₱{{ number_format($d['total']) }}</td></tr>
</table>

@if($invoice->kind === 'invoice')
  <p style="margin-top:16pt"><span class="paid">PAID</span></p>
  <p class="muted">The security deposit is refundable. It goes back to the original payment method after the trip, minus approved charges.</p>
@else
  @if(!empty($d['reason']))<p style="margin-top:14pt"><b>Reason</b>: {{ $d['reason'] }}</p>@endif
  <p class="muted">The refund goes back to the original payment method. Banks and wallets can take 3–5 banking days to show it.</p>
@endif
</body>
</html>
