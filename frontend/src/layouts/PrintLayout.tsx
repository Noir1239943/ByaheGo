import { Outlet } from 'react-router'

export default function PrintLayout() {
  return (
    <div className="min-h-screen bg-page py-6 print:bg-white print:py-0">
      <Outlet />
    </div>
  )
}
