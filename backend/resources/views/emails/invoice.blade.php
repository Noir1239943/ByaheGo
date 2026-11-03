<!doctype html>
<html lang="en">
<body style="font-family: Arial, sans-serif; color: #0e1f29; line-height: 1.5;">
<h2 style="color:#0d7c6b;margin-bottom:4px">{{ $invoice->kind === 'invoice' ? 'Invoice' : 'Refund receipt' }} {{ $invoice->number }}</h2>
<p>Hi {{ $recipient->name }},</p>
@if($invoice->kind === 'invoice')
<p>Thanks for your payment of <b>₱{{ number_format($d['total']) }}</b> for booking {{ $d['booking']['reference'] }}. Your invoice is attached.</p>
@else
<p>We refunded <b>₱{{ number_format($d['total']) }}</b> for booking {{ $d['booking']['reference'] }}. Your refund receipt is attached. Banks and wallets can take 3–5 banking days to show it.</p>
@endif
<p style="color:#5b6b76;font-size:12px">{{ $d['note'] }}</p>
<p>ByaheGo</p>
</body>
</html>
