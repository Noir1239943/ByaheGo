/** Trip status shown to people, accounting for overdue returns. */
export function tripStatus(b: { display_status: string; status: string; return_at: string }) {
  if (b.status === 'pending') return 'awaiting_payment'
  if (b.status === 'active' && new Date(b.return_at).getTime() < Date.now()) return 'overdue'
  return b.display_status
}
