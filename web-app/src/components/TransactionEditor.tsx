import type { FormEvent } from 'react'
import type { OcrResult, Receipt, TransactionPayload } from '../services/backend'

interface TransactionEditorProps {
  draft: TransactionPayload
  receipts: Receipt[]
  loading: boolean
  error: string
  ocrResult: OcrResult | null
  onChange: (draft: TransactionPayload) => void
  onSave: (event: FormEvent<HTMLFormElement>) => void
  onCancel: () => void
}

function TransactionEditor({
  draft,
  receipts,
  loading,
  error,
  ocrResult,
  onChange,
  onSave,
  onCancel,
}: TransactionEditorProps) {
  return (
    <section className="panel transaction-editor">
      <div className="section-heading">
        <div>
          <h2>{ocrResult ? 'Review extracted payment details' : 'Transaction details'}</h2>
          <p>Verify the fields before saving them to your account.</p>
        </div>
        <button className="close-button" type="button" onClick={onCancel} aria-label="Close transaction form">✕</button>
      </div>

      {ocrResult && (
        <div className="ocr-review">
          <p>{ocrResult.message || 'Review the OCR values and correct any mistakes.'}</p>
          {ocrResult.extracted_text && (
            <details>
              <summary>View extracted text</summary>
              <pre>{ocrResult.extracted_text}</pre>
            </details>
          )}
        </div>
      )}

      <form onSubmit={onSave}>
        <div className="form-grid">
          <label className="form-field">
            <span>Payer name</span>
            <input maxLength={255} value={draft.payer_name || ''} onChange={event => onChange({ ...draft, payer_name: event.target.value || null })} />
          </label>
          <label className="form-field">
            <span>Transaction ID</span>
            <input maxLength={255} value={draft.transaction_id || ''} onChange={event => onChange({ ...draft, transaction_id: event.target.value || null })} />
          </label>
          <label className="form-field">
            <span>Amount</span>
            <input type="number" min="0.01" step="0.01" required value={draft.amount} onChange={event => onChange({ ...draft, amount: event.target.value })} />
          </label>
          <label className="form-field">
            <span>Transaction date</span>
            <input type="datetime-local" required value={draft.transaction_date} onChange={event => onChange({ ...draft, transaction_date: event.target.value })} />
          </label>
          <label className="form-field">
            <span>Payment method</span>
            <input maxLength={100} value={draft.payment_method || ''} onChange={event => onChange({ ...draft, payment_method: event.target.value || null })} />
          </label>
          <label className="form-field">
            <span>Reference number</span>
            <input maxLength={255} value={draft.reference_number || ''} onChange={event => onChange({ ...draft, reference_number: event.target.value || null })} />
          </label>
          <label className="form-field form-field-wide">
            <span>Associated receipt</span>
            <select
              value={draft.receipt_id ?? ''}
              onChange={event => onChange({ ...draft, receipt_id: event.target.value ? Number(event.target.value) : null })}
            >
              <option value="">No receipt</option>
              {receipts.map(receipt => (
                <option key={receipt.id} value={receipt.id}>{receipt.original_filename}</option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="upload-actions">
          <button className="secondary-button" type="button" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Save transaction'}
          </button>
        </div>
      </form>
    </section>
  )
}

export default TransactionEditor
