import axios from 'axios'

const apiOrigin = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

export const api = axios.create({
  baseURL: `${apiOrigin}/api/v1`,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

export function apiError(e) {
  return (
    e?.response?.data?.error?.message ||
    e?.response?.data?.message ||
    e?.message ||
    'Something went wrong.'
  )
}

export async function getData(path, params) {
  const { data } = await api.get(path, { params })
  return data?.data
}

export async function postData(path, body) {
  const { data } = await api.post(path, body)
  return data?.data
}

export async function patchData(path, body) {
  const { data } = await api.patch(path, body)
  return data?.data
}

export async function deleteData(path) {
  const { data } = await api.delete(path)
  return data?.data
}