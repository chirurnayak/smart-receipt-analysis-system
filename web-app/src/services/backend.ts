import axios from 'axios'
import api from './api'

export interface User {
  id: number
  name: string
  email: string
  created_at: string
}

export interface Receipt {
  id: number
  original_filename: string
  upload_date: string
  processing_status: string
}

export interface Transaction {
  id: number
  receipt_id: number | null
  payer_name: string | null
  transaction_id: string | null
  amount: string
  transaction_date: string
  payment_method: string | null
  reference_number: string | null
  duplicate_status: boolean
  created_at: string
}

export interface TransactionPayload {
  receipt_id: number | null
  payer_name: string | null
  transaction_id: string | null
  amount: string
  transaction_date: string
  payment_method: string | null
  reference_number: string | null
}

export interface OcrField {
  value: string | null
  confidence: string
}

export interface OcrResult {
  receipt_id: number
  processing_status: string
  extracted_text: string | null
  payer_name: OcrField
  transaction_id: OcrField
  transaction_date: OcrField
  amount: OcrField
  payment_method: OcrField
  reference_number: OcrField
  message: string | null
}

export interface AnalyticsSummary {
  total_amount: string
  transaction_count: number
  unique_payers: number
  payers_above_threshold: number
  average_amount: string
  highest_payment: string
  lowest_payment: string
}

export interface PaymentMethodSummary {
  payment_method: string
  total_amount: string
  transaction_count: number
}

export interface CollectionSummary {
  date?: string
  month?: string
  total_amount: string
  transaction_count: number
}

export interface TransactionFilters {
  payer_name?: string
  transaction_id?: string
  date_from?: string
  date_to?: string
  amount_min?: string
  amount_max?: string
  payment_method?: string
  page?: number
  page_size?: number
}

export async function registerUser(name: string, email: string, password: string): Promise<User> {
  const { data } = await api.post<User>('/auth/register', { name, email, password })
  return data
}

export async function loginUser(email: string, password: string): Promise<string> {
  const { data } = await api.post<{ access_token: string; token_type: string }>('/auth/login', { email, password })
  return data.access_token
}

export async function getCurrentUser(): Promise<User> {
  const { data } = await api.get<User>('/users/me')
  return data
}

export async function listReceipts(): Promise<Receipt[]> {
  const { data } = await api.get<Receipt[]>('/receipts')
  return data
}

export async function uploadReceipt(file: File): Promise<Receipt> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post<Receipt>('/receipts', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function deleteReceipt(receiptId: number): Promise<void> {
  await api.delete(`/receipts/${receiptId}`)
}

export async function downloadReceipt(receipt: Receipt): Promise<void> {
  const { data } = await api.get<Blob>(`/receipts/${receipt.id}/download`, { responseType: 'blob' })
  saveBlob(data, receipt.original_filename)
}

export async function scanReceipt(receiptId: number): Promise<OcrResult> {
  const { data } = await api.post<OcrResult>(`/ocr/${receiptId}`)
  return data
}

export async function listTransactions(filters: TransactionFilters): Promise<Transaction[]> {
  const { data } = await api.get<Transaction[]>('/transactions', { params: filters })
  return data
}

export async function createTransaction(payload: TransactionPayload): Promise<Transaction> {
  const { data } = await api.post<Transaction>('/transactions', payload)
  return data
}

export async function updateTransaction(id: number, payload: TransactionPayload): Promise<Transaction> {
  const { data } = await api.put<Transaction>(`/transactions/${id}`, payload)
  return data
}

export async function deleteTransaction(id: number): Promise<void> {
  await api.delete(`/transactions/${id}`)
}

export async function getAnalyticsSummary(
  filters: Pick<TransactionFilters, 'date_from' | 'date_to'> & { threshold?: string },
): Promise<AnalyticsSummary> {
  const { data } = await api.get<AnalyticsSummary>('/analytics/summary', { params: filters })
  return data
}

export async function getPaymentMethods(filters: Pick<TransactionFilters, 'date_from' | 'date_to'>): Promise<PaymentMethodSummary[]> {
  const { data } = await api.get<PaymentMethodSummary[]>('/analytics/payment-methods', { params: filters })
  return data
}

export async function getDailyCollections(filters: Pick<TransactionFilters, 'date_from' | 'date_to'>): Promise<CollectionSummary[]> {
  const { data } = await api.get<CollectionSummary[]>('/analytics/daily', { params: filters })
  return data
}

export async function getMonthlyCollections(filters: Pick<TransactionFilters, 'date_from' | 'date_to'>): Promise<CollectionSummary[]> {
  const { data } = await api.get<CollectionSummary[]>('/analytics/monthly', { params: filters })
  return data
}

export async function downloadReport(format: 'excel' | 'pdf', filters: TransactionFilters): Promise<void> {
  const { data, headers } = await api.get<Blob>(`/exports/${format}`, {
    params: filters,
    responseType: 'blob',
  })
  const filename = format === 'excel' ? 'transactions.xlsx' : 'payment-report.pdf'
  const disposition = headers['content-disposition'] as string | undefined
  const serverFilename = disposition?.match(/filename="?([^";]+)"?/i)?.[1]
  saveBlob(data, serverFilename || filename)
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail: unknown = error.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (error.response?.status === 401 || error.response?.status === 403) {
      return 'Your session expired. Please sign in again.'
    }
    if (error.message === 'Network Error') {
      return 'Could not reach the backend. Check that the API server is running.'
    }
  }
  return error instanceof Error ? error.message : fallback
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
