import type { Booking } from '@/types'

/** Download an .ics file so the trip shows up in Google/Apple Calendar. */
export function downloadIcs(b: Booking) {
  const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ByaheGo//Trips//EN', 'BEGIN:VEVENT',
    `UID:${b.reference}@byahego`, `DTSTAMP:${fmt(new Date().toISOString())}`, `DTSTART:${fmt(b.pickup_at)}`, `DTEND:${fmt(b.return_at)}`,
    `SUMMARY:ByaheGo trip – ${b.vehicle.name}`, `LOCATION:${b.pickup_label}`,
    `DESCRIPTION:Booking ${b.reference}. Bring your driver's license and one valid ID.`, 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `byahego-${b.reference}.ics`
  a.click()
  URL.revokeObjectURL(url)
}
