import { api } from '@/lib/api'

/** Downloads a file the API protects with the login token (a plain link can't send it). */
export async function downloadFile(path: string, filename: string) {
  const res = await api.get<Blob>(path, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
