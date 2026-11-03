<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Evidence packet {{ $b->reference }}</title>
<style>
  @page { margin: 20mm 14mm 18mm 14mm; }
  body { font-family: 'DejaVu Sans', sans-serif; font-size: 9pt; color: #0e1f29; line-height: 1.4; }
  .brand { color: #0d7c6b; font-size: 16pt; font-weight: bold; }
  h1 { font-size: 14pt; margin: 4pt 0; }
  h2 { font-size: 10.5pt; color: #0d7c6b; margin: 14pt 0 4pt; border-bottom: 1px solid #0d7c6b; padding-bottom: 2pt; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 3pt 5pt; border: 1px solid #d9e0e5; vertical-align: top; text-align: left; }
  th { background: #f3f6f8; }
  td.k { width: 28%; background: #f3f6f8; font-weight: bold; }
  .muted { color: #5b6b76; }
  .small { font-size: 7.5pt; }
  .photo td { border: 0; padding: 3pt; width: 33%; text-align: center; }
  .photo img { width: 100%; border: 1px solid #d9e0e5; }
  .warn { border: 1px solid #b42318; color: #b42318; padding: 5pt; margin: 6pt 0; }
  .footer { position: fixed; bottom: -12mm; left: 0; right: 0; font-size: 7.5pt; color: #5b6b76; text-align: center; }
  .pb { page-break-before: always; }
</style>
</head>
<body>
<div class="footer">ByaheGo evidence packet {{ $b->reference }} · generated {{ $generatedAt }} (Philippine time) · confidential, for law enforcement and insurers</div>

<div class="brand">ByaheGo</div>
<h1>Evidence packet · booking {{ $b->reference }}</h1>
<p class="muted">Generated {{ $generatedAt }}. Status: {{ $b->status }}@if($b->admin_flag) · FLAG: {{ str_replace('_', ' ', $b->admin_flag) }}@endif</p>
@if($b->admin_flag === 'possible_theft')<div class="warn"><b>Possible theft.</b> {{ $b->admin_flag_note }}</div>@endif

<h2>1. People</h2>
<table>
  <tr><td class="k">Renter (verified identity)</td><td>{{ $license?->full_name ?? $b->renter->name }}<br>Account: {{ $b->renter->name }} (&#64;{{ $b->renter->username }})<br>Email: {{ $b->renter->email }} · Phone: {{ $b->renter->phone ?? '—' }}<br>Driver on the booking: {{ $b->driver_name }} · {{ $b->driver_phone }} · {{ $b->driver_email }}</td></tr>
  @if($license)
  <tr><td class="k">Driver's license</td><td>No. {{ $license->license_number }} · type {{ $license->license_type }} · status {{ $license->status }}<br>Birth date: {{ $license->birthdate?->format('M j, Y') }} · Expires: {{ $license->expiry_date?->format('M j, Y') }}<br>Address: {{ $license->address ?? '—' }} · Nationality: {{ $license->nationality ?? '—' }}<br>Restrictions: {{ implode(', ', $license->restriction_codes ?? []) ?: '—' }}</td></tr>
  @endif
  <tr><td class="k">Host (owner)</td><td>{{ $b->host->name }}<br>Email: {{ $b->host->email }} · Phone: {{ $b->host->phone ?? '—' }}</td></tr>
  <tr><td class="k">Vehicle</td><td>{{ $b->vehicle->name }} · plate {{ $b->vehicle->plate_number ?? '—' }}@if($b->vehicle->color) · {{ $b->vehicle->color }}@endif</td></tr>
</table>
@if(array_filter($idPhotos))
<table class="photo" style="margin-top:6pt"><tr>
  @foreach($idPhotos as $label => $img)@if($img)<td><img src="{{ $img }}"><div class="small muted">{{ $label }}</div></td>@endif @endforeach
</tr></table>
@endif

<h2>2. Booking</h2>
<table>
  <tr><td class="k">Trip</td><td>Pick-up {{ $b->pickup_at->timezone('Asia/Manila')->format('M j, Y g:i A') }} · return due {{ $b->return_at->timezone('Asia/Manila')->format('M j, Y g:i A') }}@if($b->actual_return_at) · returned {{ $b->actual_return_at->timezone('Asia/Manila')->format('M j, Y g:i A') }}@endif</td></tr>
  <tr><td class="k">Pick-up place</td><td>{{ $b->pickup_label }}@if($b->pickup_lat) ({{ $b->pickup_lat }}, {{ $b->pickup_lng }})@endif</td></tr>
  <tr><td class="k">Amounts</td><td>Trip total ₱{{ number_format($b->total) }} · deposit ₱{{ number_format($b->security_deposit) }} · late fee ₱{{ number_format($b->late_fee) }} ({{ $b->late_hours }} h) · damage ₱{{ number_format($b->damage_charge) }} · balance due ₱{{ number_format($b->balance_due) }}</td></tr>
</table>

<h2>3. Payments</h2>
<table>
  <tr><th>Receipt</th><th>Type</th><th>Method</th><th>Status</th><th>Amount</th><th>Invoice / provider ref</th></tr>
  @foreach($b->payments as $p)
  <tr><td>{{ $p->receipt_no }}</td><td>{{ $p->type }}</td><td>{{ $p->method }}</td><td>{{ $p->status }}</td><td>₱{{ number_format($p->amount) }}</td><td class="small">{{ $p->invoice?->number }} {{ $p->provider_payment_id ?? $p->provider_refund_id }}</td></tr>
  @endforeach
</table>

<h2>4. Incidents</h2>
@forelse($b->incidents as $i)
<table style="margin-bottom:5pt">
  <tr><td class="k">#{{ $i->id }} · {{ str_replace('_', ' ', $i->type) }}</td><td>{{ $i->created_at->timezone('Asia/Manila')->format('M j, Y g:i A') }} · reported by {{ $i->reporter?->name }} · status {{ $i->status }}<br>{{ $i->description }}@if($i->lat)<br>Location: {{ $i->lat }}, {{ $i->lng }}@endif @if($i->pins)<br>Pins: @foreach($i->pins as $pin){{ $pin['angle'] }} ({{ round($pin['x'] * 100) }}%, {{ round($pin['y'] * 100) }}%) {{ $pin['note'] ?? '' }}; @endforeach @endif</td></tr>
</table>
@empty
<p class="muted">No incidents reported.</p>
@endforelse

<h2>5. Timeline</h2>
<table>
  @foreach($b->events->sortBy('id') as $e)
  <tr><td style="width:25%" class="small">{{ $e->created_at->timezone('Asia/Manila')->format('M j, Y g:i A') }}</td><td class="small">{{ $e->message }} <span class="muted">({{ $e->actor?->name ?? 'system' }})</span></td></tr>
  @endforeach
</table>

@foreach($sets as $set)
<div class="pb"></div>
<h2>{{ $loop->iteration + 5 }}. Photos: {{ $set['title'] }}</h2>
<p class="small">Odometer {{ number_format($set['inspection']->odometer) }} km · fuel {{ $set['inspection']->fuel_level }}% · submitted {{ $set['inspection']->submitted_at?->timezone('Asia/Manila')->format('M j, Y g:i A') }} · host: {{ $set['inspection']->host_status ?? '—' }}@if($set['inspection']->notes) · notes: {{ $set['inspection']->notes }}@endif</p>
<table class="photo">
  @foreach($set['photos']->chunk(3) as $row)
  <tr>
    @foreach($row as $x)
    <td>@if($x['img'])<img src="{{ $x['img'] }}">@endif
      <div class="small"><b>{{ $x['label'] }}</b> · by {{ $x['by'] }} · {{ $x['p']->live ? 'live camera' : 'UPLOADED, not live' }}<br>
      device {{ $x['p']->device_time?->timezone('Asia/Manila')->format('M j g:i:s A') ?? '—' }} · server {{ $x['p']->created_at?->timezone('Asia/Manila')->format('M j g:i:s A') }}<br>
      GPS {{ $x['p']->lat ? $x['p']->lat.', '.$x['p']->lng : 'not shared' }}<br><span class="muted">sha256 {{ substr($x['p']->sha256, 0, 16) }}…</span>@if($x['p']->note)<br>{{ $x['p']->note }}@endif</div></td>
    @endforeach
    @for($k = $row->count(); $k < 3; $k++)<td></td>@endfor
  </tr>
  @endforeach
</table>
@endforeach

@if($b->agreement)
<div class="pb"></div>
<h2>Signed rental agreement</h2>
<p class="small">Signed electronically by <b>{{ $b->agreement->signer_name }}</b> on {{ $b->agreement->signed_at?->timezone('Asia/Manila')->format('M j, Y g:i A') }} · IP {{ $b->agreement->ip ?? 'not recorded' }} · version {{ $b->agreement->version }}<br>Document hash (SHA-256): {{ $b->agreement->hash }}</p>
@foreach($sections as $s)
  <p><b>{{ $s['title'] }}</b></p>
  @foreach($s['body'] as $line)<p class="small">{{ $line }}</p>@endforeach
@endforeach
@endif
</body>
</html>
