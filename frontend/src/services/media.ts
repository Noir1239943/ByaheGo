import { api } from '@/lib/api'
import { compressImage } from '@/lib/image'

export type MediaPurpose = 'vehicle_photo' | 'license_front' | 'license_back' | 'selfie' | 'vehicle_or' | 'vehicle_cr' | 'vehicle_ctpl' | 'incident' | 'inspection'

export const mediaService = {
  async upload(file: File, purpose: MediaPurpose) {
    const small = await compressImage(file)
    const form = new FormData()
    form.append('file', small)
    form.append('purpose', purpose)
    const res = await api.post<{ id: number; url: string; width: number; height: number }>('/media', form)
    return res.data
  },
  /** Private documents (licenses, OR/CR) need the sign-in token, so load them as a blob URL. */
  async objectUrl(id: number, width?: number) {
    const res = await api.get(`/media/${id}`, { responseType: 'blob', params: width ? { w: width } : undefined })
    return URL.createObjectURL(res.data as Blob)
  },
}
