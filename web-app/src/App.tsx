import { useEffect, useMemo, useState, type FormEvent } from 'react'
import AuthPanel from './components/AuthPanel'
import TransactionEditor from './components/TransactionEditor'
import {
  ACCESS_TOKEN_KEY,
} from './services/api'
import {
  createTransaction,
  deleteReceipt,
  deleteTransaction,
  downloadReceipt,
  downloadReport,
  getAnalyticsSummary,
  getCurrentUser,
  getDailyCollections,
  getErrorMessage,
  getMonthlyCollections,
  getPaymentMethods,
  listReceipts,
  listTransactions,
  scanReceipt,
  updateTransaction,
  uploadReceipt,
  type AnalyticsSummary,
  type CollectionSummary,
  type OcrResult,
  type PaymentMethodSummary,
  type Receipt,
  type Transaction,
  type TransactionFilters,
  type TransactionPayload,
  type User,
} from './services/backend'
import './App.css'

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount)

const dateBoundary = (date: string, endOfDay = false) => {
  if (!date) return undefined
  return `${date}T${endOfDay ? '23:59:59' : '00:00:00'}`
}

function emptyTransaction(receiptId: number | null = null): TransactionPayload {
  return {
    receipt_id: receiptId,
    payer_name: null,
    transaction_id: null,
    amount: '',
    transaction_date: '',
    payment_method: null,
    reference_number: null,
  }
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authChecking, setAuthChecking] = useState(() => Boolean(localStorage.getItem(ACCESS_TOKEN_KEY)))
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodSummary[]>([])
  const [dailyCollections, setDailyCollections] = useState<CollectionSummary[]>([])
  const [monthlyCollections, setMonthlyCollections] = useState<CollectionSummary[]>([])
  const [activePage, setActivePage] = useState('Dashboard')
  const [payerSearch, setPayerSearch] = useState('')
  const [transactionIdSearch, setTransactionIdSearch] = useState('')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')
  const [threshold, setThreshold] = useState('')
  const [page, setPage] = useState(1)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [draft, setDraft] = useState<TransactionPayload | null>(null)
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null)
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null)
  const [error, setError] = useState('')
  const [dataLoading, setDataLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [refreshVersion, setRefreshVersion] = useState(0)

  const transactionFilters = useMemo<TransactionFilters>(() => ({
    payer_name: payerSearch.trim() || undefined,
    transaction_id: transactionIdSearch.trim() || undefined,
    date_from: dateBoundary(dateFrom),
    date_to: dateBoundary(dateTo, true),
    amount_min: amountMin || undefined,
    amount_max: amountMax || undefined,
    payment_method: paymentMethodFilter || undefined,
    page,
    page_size: 20,
  }), [payerSearch, transactionIdSearch, dateFrom, dateTo, amountMin, amountMax, paymentMethodFilter, page])

  useEffect(() => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (!token) return

    let active = true
    getCurrentUser()
      .then(currentUser => {
        if (active) setUser(currentUser)
      })
      .catch(() => {
        localStorage.removeItem(ACCESS_TOKEN_KEY)
      })
      .finally(() => {
        if (active) setAuthChecking(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!user) return
    let active = true
    const dateFilters = {
      date_from: dateBoundary(dateFrom),
      date_to: dateBoundary(dateTo, true),
    }
    const timeout = window.setTimeout(() => {
      setDataLoading(true)
      Promise.all([
        listReceipts(),
        getAnalyticsSummary({ ...dateFilters, threshold: threshold || '0' }),
        getPaymentMethods(dateFilters),
        getDailyCollections(dateFilters),
        getMonthlyCollections(dateFilters),
      ])
        .then(([receiptData, analyticsData, methods, daily, monthly]) => {
          if (!active) return
          setReceipts(receiptData)
          setSummary(analyticsData)
          setPaymentMethods(methods)
          setDailyCollections(daily)
          setMonthlyCollections(monthly)
        })
        .catch(requestError => {
          if (active) setError(getErrorMessage(requestError, 'Could not load your account data.'))
        })
        .finally(() => {
          if (active) setDataLoading(false)
        })
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [user, dateFrom, dateTo, threshold, refreshVersion])

  useEffect(() => {
    if (!user) return
    let active = true
    const timeout = window.setTimeout(() => {
      setDataLoading(true)
      listTransactions(transactionFilters)
        .then(data => {
          if (active) setTransactions(data)
        })
        .catch(requestError => {
          if (active) setError(getErrorMessage(requestError, 'Could not load transactions.'))
        })
        .finally(() => {
          if (active) setDataLoading(false)
        })
    }, 250)
    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [user, transactionFilters, refreshVersion])

  const total = Number(summary?.total_amount || 0)
  const transactionCount = summary?.transaction_count || 0
  const processedReceipts = receipts.filter(receipt => receipt.processing_status === 'processed').length
  const pendingReceipts = receipts.filter(receipt => receipt.processing_status !== 'processed').length
  const isReceiptPage = activePage === 'All Receipts'

  const filteredReceipts = useMemo(() => receipts.filter(receipt =>
    receipt.original_filename.toLowerCase().includes(payerSearch.toLowerCase()),
  ), [receipts, payerSearch])

  const navigation = [
    { name: 'Dashboard', icon: '▦' },
    { name: 'Upload Receipt', icon: '⇧' },
    { name: 'All Receipts', icon: '▤' },
    { name: 'Analytics', icon: '◫' },
    { name: 'Reports', icon: '▧' },
  ]

  function openTransactionForm(receiptId: number | null = null) {
    setEditingTransactionId(null)
    setOcrResult(null)
    setDraft(emptyTransaction(receiptId))
    setError('')
  }

  function closeTransactionForm() {
    setDraft(null)
    setEditingTransactionId(null)
    setOcrResult(null)
    setError('')
  }

  async function handleUpload() {
    if (!selectedFile) {
      setError('Choose a receipt file before uploading.')
      return
    }
    setActionLoading('upload')
    setError('')
    try {
      const receipt = await uploadReceipt(selectedFile)
      setSelectedFile(null)
      setActivePage('All Receipts')
      setRefreshVersion(value => value + 1)
      try {
        const result = await scanReceipt(receipt.id)
        setOcrResult(result)
        setDraft({
          receipt_id: receipt.id,
          payer_name: result.payer_name.value,
          transaction_id: result.transaction_id.value,
          amount: result.amount.value || '',
          transaction_date: result.transaction_date.value
            ? `${result.transaction_date.value.slice(0, 10)}T00:00`
            : '',
          payment_method: result.payment_method.value,
          reference_number: result.reference_number.value,
        })
        setEditingTransactionId(null)
        if (result.processing_status !== 'processed') {
          setError(result.message || 'OCR did not find readable text. Enter the transaction details manually.')
        }
      } catch (ocrError) {
        setOcrResult(null)
        setDraft(emptyTransaction(receipt.id))
        setEditingTransactionId(null)
        setError(`Receipt uploaded, but OCR failed: ${getErrorMessage(ocrError, 'Enter the transaction details manually.')}`)
      }
    } catch (uploadError) {
      setError(getErrorMessage(uploadError, 'Receipt upload failed.'))
    } finally {
      setActionLoading('')
    }
  }

  async function handleScan(receipt: Receipt) {
    setActionLoading(`ocr-${receipt.id}`)
    setError('')
    try {
      const result = await scanReceipt(receipt.id)
      setOcrResult(result)
      setDraft({
        receipt_id: receipt.id,
        payer_name: result.payer_name.value,
        transaction_id: result.transaction_id.value,
        amount: result.amount.value || '',
        transaction_date: result.transaction_date.value
          ? `${result.transaction_date.value.slice(0, 10)}T00:00`
          : '',
        payment_method: result.payment_method.value,
        reference_number: result.reference_number.value,
      })
      setEditingTransactionId(null)
      if (result.processing_status !== 'processed') {
        setError(result.message || 'OCR did not find readable text. Correct or enter the fields before saving.')
      }
    } catch (scanError) {
      setError(getErrorMessage(scanError, 'OCR processing failed.'))
      setOcrResult(null)
      setDraft(emptyTransaction(receipt.id))
      setEditingTransactionId(null)
    } finally {
      setActionLoading('')
    }
  }

  async function handleSaveTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft) return
    setFormLoading(true)
    setError('')
    const payload = {
      ...draft,
      payer_name: draft.payer_name?.trim() || null,
      transaction_id: draft.transaction_id?.trim() || null,
      payment_method: draft.payment_method?.trim() || null,
      reference_number: draft.reference_number?.trim() || null,
    }
    try {
      if (editingTransactionId !== null) {
        await updateTransaction(editingTransactionId, payload)
      } else {
        await createTransaction(payload)
      }
      closeTransactionForm()
      setPage(1)
      setRefreshVersion(value => value + 1)
      setActivePage('Analytics')
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Could not save this transaction.'))
    } finally {
      setFormLoading(false)
    }
  }

  function handleEditTransaction(transaction: Transaction) {
    setEditingTransactionId(transaction.id)
    setOcrResult(null)
    setDraft({
      receipt_id: transaction.receipt_id,
      payer_name: transaction.payer_name,
      transaction_id: transaction.transaction_id,
      amount: String(transaction.amount),
      transaction_date: transaction.transaction_date.slice(0, 16),
      payment_method: transaction.payment_method,
      reference_number: transaction.reference_number,
    })
    setError('')
  }

  async function handleDeleteTransaction(transaction: Transaction) {
    if (!window.confirm(`Delete transaction ${transaction.transaction_id || transaction.id}?`)) return
    setActionLoading(`delete-transaction-${transaction.id}`)
    setError('')
    try {
      await deleteTransaction(transaction.id)
      setRefreshVersion(value => value + 1)
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Could not delete this transaction.'))
    } finally {
      setActionLoading('')
    }
  }

  async function handleDeleteReceipt(receipt: Receipt) {
    if (!window.confirm(`Delete receipt "${receipt.original_filename}"?`)) return
    setActionLoading(`delete-receipt-${receipt.id}`)
    setError('')
    try {
      await deleteReceipt(receipt.id)
      setRefreshVersion(value => value + 1)
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Could not delete this receipt. It may still be linked to transactions.'))
    } finally {
      setActionLoading('')
    }
  }

  async function handleDownloadReceipt(receipt: Receipt) {
    setActionLoading(`download-${receipt.id}`)
    setError('')
    try {
      await downloadReceipt(receipt)
    } catch (downloadError) {
      setError(getErrorMessage(downloadError, 'Could not download this receipt.'))
    } finally {
      setActionLoading('')
    }
  }

  async function handleExport(format: 'excel' | 'pdf') {
    setActionLoading(`export-${format}`)
    setError('')
    try {
      await downloadReport(format, {
        payer_name: payerSearch.trim() || undefined,
        transaction_id: transactionIdSearch.trim() || undefined,
        date_from: dateBoundary(dateFrom),
        date_to: dateBoundary(dateTo, true),
        amount_min: amountMin || undefined,
        amount_max: amountMax || undefined,
        payment_method: paymentMethodFilter || undefined,
      })
    } catch (exportError) {
      setError(getErrorMessage(exportError, `Could not create the ${format.toUpperCase()} report.`))
    } finally {
      setActionLoading('')
    }
  }

  function signOut() {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    setUser(null)
    setReceipts([])
    setTransactions([])
    setSummary(null)
    closeTransactionForm()
  }

  if (authChecking) {
    return <main className="auth-screen"><p>Checking your session…</p></main>
  }
  if (!user) {
    return <AuthPanel onAuthenticated={setUser} />
  }

  const pageTitle = activePage === 'Dashboard' ? 'Dashboard' : activePage
  const maxMethodAmount = Math.max(1, ...paymentMethods.map(method => Number(method.total_amount)))

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">₹</div>
          <div>
            <h2>ReceiptIQ</h2>
            <span>PAYMENT ANALYTICS</span>
          </div>
        </div>

        <div className="nav-label">WORKSPACE</div>
        <nav className="navigation">
          {navigation.map(item => (
            <button
              key={item.name}
              className={`nav-item ${activePage === item.name ? 'active' : ''}`}
              onClick={() => {
                setActivePage(item.name)
                setError('')
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.name}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">✦</div>
            <h3>Need assistance?</h3>
            <p>Manage your receipts and financial records with ease.</p>
            <button onClick={() => setError('For account assistance, contact your system administrator.')}>Get Help →</button>
          </div>
          <div className="profile">
            <div className="avatar">{user.name.charAt(0).toUpperCase()}</div>
            <div className="profile-info">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
            <button className="profile-menu" onClick={signOut} title="Sign out" aria-label="Sign out">↪</button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span><span>/</span><strong>{pageTitle}</strong>
          </div>
          <div className="topbar-right">
            <span className="date-label">
              {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <div className="avatar small-avatar">{user.name.charAt(0).toUpperCase()}</div>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-section">
            <div>
              <p className="eyebrow">OVERVIEW</p>
              <h1>{pageTitle === 'Dashboard' ? `Good day, ${user.name} 👋` : pageTitle}</h1>
              <p className="subtitle">
                {pageTitle === 'Dashboard'
                  ? 'Here is what is happening with your receipts today.'
                  : `Manage and monitor your ${pageTitle.toLowerCase()} efficiently.`}
              </p>
            </div>
            <button className="primary-button" onClick={() => {
              setActivePage('Upload Receipt')
              closeTransactionForm()
            }}>
              <span>＋</span> Upload Receipt
            </button>
          </section>

          {error && !draft && <div className="app-alert" role="alert">{error}</div>}
          {dataLoading && <div className="loading-message" role="status">Loading your records…</div>}

          {draft && (
            <TransactionEditor
              draft={draft}
              receipts={receipts}
              loading={formLoading}
              error={error}
              ocrResult={ocrResult}
              onChange={setDraft}
              onSave={handleSaveTransaction}
              onCancel={closeTransactionForm}
            />
          )}

          {activePage === 'Upload Receipt' ? (
            <section className="panel upload-panel">
              <div className="section-heading">
                <div>
                  <h2>Upload a Receipt</h2>
                  <p>Add a receipt image or PDF to your records.</p>
                </div>
                <button className="close-button" onClick={() => setActivePage('Dashboard')} aria-label="Close upload">✕</button>
              </div>
              <label className="upload-zone">
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  onChange={event => setSelectedFile(event.target.files?.[0] || null)}
                />
                <div className="upload-symbol">↑</div>
                <h3>{selectedFile ? selectedFile.name : 'Drag and drop your receipt here'}</h3>
                <p>Or click to browse files</p>
                <span>Supported formats: JPG, JPEG, PNG, WEBP, PDF (max 10 MB)</span>
              </label>
              {selectedFile && (
                <div className="selected-file">
                  <span>📄 {selectedFile.name}</span>
                  <button onClick={() => setSelectedFile(null)}>Remove</button>
                </div>
              )}
              <div className="upload-actions">
                <button className="secondary-button" onClick={() => setSelectedFile(null)} disabled={actionLoading === 'upload'}>Clear</button>
                <button className="primary-button" onClick={handleUpload} disabled={actionLoading === 'upload'}>
                  {actionLoading === 'upload' ? 'Uploading and scanning…' : 'Upload and scan →'}
                </button>
              </div>
              <p className="notice">OCR values are suggestions. Review and correct them before saving a transaction.</p>
            </section>
          ) : activePage === 'Reports' ? (
            <section className="panel report-panel">
              <div className="section-heading">
                <div>
                  <h2>Financial Reports</h2>
                  <p>Download transaction reports using the current date, amount, and payment filters.</p>
                </div>
              </div>
              <div className="report-summary">
                <div><span>Total receipts</span><strong>{receipts.length}</strong></div>
                <div><span>Total collected</span><strong>{formatCurrency(total)}</strong></div>
                <div><span>Transactions</span><strong>{transactionCount}</strong></div>
              </div>
              <div className="report-actions">
                <button className="primary-button" onClick={() => handleExport('excel')} disabled={actionLoading === 'export-excel'}>
                  {actionLoading === 'export-excel' ? 'Generating…' : '↓ Download Excel'}
                </button>
                <button className="secondary-button" onClick={() => handleExport('pdf')} disabled={actionLoading === 'export-pdf'}>
                  {actionLoading === 'export-pdf' ? 'Generating…' : '↓ Download PDF'}
                </button>
              </div>
            </section>
          ) : (
            <>
              {(activePage === 'Dashboard' || activePage === 'Analytics') && (
                <section className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-top"><span>Total Payments</span><span className="stat-icon blue">₹</span></div>
                    <h2>{formatCurrency(total)}</h2>
                    <p className="stat-foot">For the selected date range</p>
                  </div>
                  <div className="stat-card">
                    <div className="stat-top"><span>Total Transactions</span><span className="stat-icon purple">▤</span></div>
                    <h2>{transactionCount}</h2>
                    <p className="stat-foot">Recorded transactions</p>
                  </div>
                  <div className="stat-card">
                    <div className="stat-top"><span>Unique Payers</span><span className="stat-icon green">✓</span></div>
                    <h2>{summary?.unique_payers || 0}</h2>
                    <p className="stat-foot">Normalized payer names</p>
                  </div>
                  <div className="stat-card">
                    <div className="stat-top"><span>Payers Above Threshold</span><span className="stat-icon orange">◷</span></div>
                    <h2>{summary?.payers_above_threshold || 0}</h2>
                    <p className="stat-foot">Threshold: {formatCurrency(Number(threshold || 0))}</p>
                  </div>
                  {activePage === 'Analytics' && (
                    <>
                      <div className="stat-card">
                        <div className="stat-top"><span>Average Payment</span><span className="stat-icon blue">↗</span></div>
                        <h2>{formatCurrency(Number(summary?.average_amount || 0))}</h2>
                        <p className="stat-foot">Per transaction</p>
                      </div>
                      <div className="stat-card">
                        <div className="stat-top"><span>Highest Payment</span><span className="stat-icon green">↑</span></div>
                        <h2>{formatCurrency(Number(summary?.highest_payment || 0))}</h2>
                        <p className="stat-foot">For the selected date range</p>
                      </div>
                      <div className="stat-card">
                        <div className="stat-top"><span>Lowest Payment</span><span className="stat-icon orange">↓</span></div>
                        <h2>{formatCurrency(Number(summary?.lowest_payment || 0))}</h2>
                        <p className="stat-foot">For the selected date range</p>
                      </div>
                    </>
                  )}
                </section>
              )}

              {activePage === 'Dashboard' && (
                <section className="analytics-grid">
                  <div className="panel chart-panel">
                    <div className="section-heading">
                      <div><h2>Payment Overview</h2><p>Collections by payment method</p></div>
                      <span className="period-tag">FILTERED</span>
                    </div>
                    <div className="bar-chart">
                      {paymentMethods.slice(0, 5).map((method, index) => {
                        const amount = Number(method.total_amount)
                        return (
                          <div className="bar-item" key={method.payment_method}>
                            <div className="bar-value">{formatCurrency(amount)}</div>
                            <div className="bar-track">
                              <div className={`bar-fill bar-${index}`} style={{ height: `${Math.max(4, (amount / maxMethodAmount) * 100)}%` }} />
                            </div>
                            <span>{method.payment_method}</span>
                          </div>
                        )
                      })}
                      {paymentMethods.length === 0 && <div className="empty-state">No payments in this date range.</div>}
                    </div>
                  </div>
                  <div className="panel breakdown-panel">
                    <div className="section-heading">
                      <div><h2>Receipt Status</h2><p>OCR processing summary</p></div>
                    </div>
                    <div className="status-circle"><div><strong>{receipts.length}</strong><span>Total</span></div></div>
                    <div className="status-legend">
                      <div><span className="legend-dot verified-dot" /> Processed <strong>{processedReceipts}</strong></div>
                      <div><span className="legend-dot pending-dot" /> Needs review <strong>{pendingReceipts}</strong></div>
                    </div>
                  </div>
                </section>
              )}

              {activePage === 'Analytics' && (
                <section className="analytics-grid">
                  <div className="panel collection-panel">
                    <div className="section-heading"><div><h2>Daily collections</h2><p>Totals by transaction date</p></div></div>
                    {dailyCollections.slice(-7).reverse().map(item => (
                      <div className="collection-row" key={item.date}>
                        <span>{item.date}</span><strong>{formatCurrency(Number(item.total_amount))}</strong>
                        <small>{item.transaction_count} transactions</small>
                      </div>
                    ))}
                    {dailyCollections.length === 0 && <div className="empty-state">No daily data for this date range.</div>}
                  </div>
                  <div className="panel collection-panel">
                    <div className="section-heading"><div><h2>Monthly collections</h2><p>Totals by calendar month</p></div></div>
                    {monthlyCollections.slice(-6).reverse().map(item => (
                      <div className="collection-row" key={item.month}>
                        <span>{item.month}</span><strong>{formatCurrency(Number(item.total_amount))}</strong>
                        <small>{item.transaction_count} transactions</small>
                      </div>
                    ))}
                    {monthlyCollections.length === 0 && <div className="empty-state">No monthly data for this date range.</div>}
                  </div>
                </section>
              )}

              <section className="panel receipts-panel">
                <div className="section-heading">
                  <div>
                    <h2>{isReceiptPage ? 'Uploaded Receipts' : activePage === 'Analytics' ? 'Payment Records' : 'Recent Transactions'}</h2>
                    <p>{isReceiptPage ? 'Scan, download, or remove your uploaded receipt files.' : 'Search, filter, edit, and manage your transactions.'}</p>
                  </div>
                  <div className="section-actions">
                    {!isReceiptPage && <button className="secondary-button" onClick={() => openTransactionForm()}>＋ Add transaction</button>}
                    {!isReceiptPage && <button className="text-button" onClick={() => setActivePage('All Receipts')}>View receipts →</button>}
                  </div>
                </div>

                <div className="table-controls">
                  <div className="search-box">
                    <span>⌕</span>
                    <input
                      placeholder={isReceiptPage ? 'Search receipt files…' : 'Search payer name…'}
                      value={payerSearch}
                      onChange={event => {
                        setPayerSearch(event.target.value)
                        setPage(1)
                      }}
                    />
                  </div>
                  {!isReceiptPage && (
                    <>
                      <input className="filter-input" placeholder="Transaction ID" value={transactionIdSearch} onChange={event => {
                        setTransactionIdSearch(event.target.value)
                        setPage(1)
                      }} />
                      <input className="filter-input" type="date" aria-label="From date" value={dateFrom} onChange={event => {
                        setDateFrom(event.target.value)
                        setPage(1)
                      }} />
                      <input className="filter-input" type="date" aria-label="To date" value={dateTo} onChange={event => {
                        setDateTo(event.target.value)
                        setPage(1)
                      }} />
                      <input className="filter-input amount-filter" type="number" min="0" step="0.01" placeholder="Min amount" value={amountMin} onChange={event => {
                        setAmountMin(event.target.value)
                        setPage(1)
                      }} />
                      <input className="filter-input amount-filter" type="number" min="0" step="0.01" placeholder="Max amount" value={amountMax} onChange={event => {
                        setAmountMax(event.target.value)
                        setPage(1)
                      }} />
                      <select value={paymentMethodFilter} onChange={event => {
                        setPaymentMethodFilter(event.target.value)
                        setPage(1)
                      }}>
                        <option value="">All payment methods</option>
                        {paymentMethods.map(method => <option key={method.payment_method} value={method.payment_method}>{method.payment_method}</option>)}
                      </select>
                      <input className="filter-input amount-filter" type="number" min="0" step="0.01" placeholder="Payer threshold" value={threshold} onChange={event => setThreshold(event.target.value)} />
                    </>
                  )}
                  {isReceiptPage && (
                    <button className="secondary-button" onClick={() => {
                      setPayerSearch('')
                      setPage(1)
                    }}>Clear search</button>
                  )}
                </div>

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>{isReceiptPage ? 'RECEIPT NAME' : 'PAYER NAME'}</th>
                        <th>{isReceiptPage ? 'FILE' : 'TRANSACTION ID'}</th>
                        <th>{isReceiptPage ? 'UPLOADED' : 'DATE'}</th>
                        <th>AMOUNT</th>
                        <th>STATUS</th>
                        <th>{isReceiptPage ? 'OCR' : 'PAYMENT'}</th>
                        {!isReceiptPage && <th>REFERENCE</th>}
                        <th>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isReceiptPage ? filteredReceipts.map(receipt => {
                        const processed = receipt.processing_status === 'processed'
                        const busy = actionLoading === `ocr-${receipt.id}` || actionLoading === `delete-receipt-${receipt.id}` || actionLoading === `download-${receipt.id}`
                        return (
                          <tr key={`receipt-${receipt.id}`}>
                            <td><div className="receipt-name"><span className="receipt-icon">▤</span><strong>{receipt.original_filename}</strong></div></td>
                            <td>Receipt file</td>
                            <td>{new Date(receipt.upload_date).toLocaleDateString('en-IN')}</td>
                            <td className="amount-cell">—</td>
                            <td><span className={`status-badge ${processed ? 'verified' : 'pending'}`}><span />{receipt.processing_status}</span></td>
                            <td>{processed ? 'Available' : 'Not scanned'}</td>
                            <td className="row-actions">
                              <button className="text-button" disabled={busy} onClick={() => handleScan(receipt)}>Scan OCR</button>
                              <button className="text-button" disabled={busy} onClick={() => openTransactionForm(receipt.id)}>Add payment</button>
                              <button className="text-button" disabled={busy} onClick={() => handleDownloadReceipt(receipt)}>Download</button>
                              <button className="text-button danger-text" disabled={busy} onClick={() => handleDeleteReceipt(receipt)}>Delete</button>
                            </td>
                          </tr>
                        )
                      }) : transactions.map(transaction => {
                        const busy = actionLoading === `delete-transaction-${transaction.id}`
                        return (
                          <tr key={`transaction-${transaction.id}`}>
                            <td><div className="receipt-name"><span className="receipt-icon">₹</span><strong>{transaction.payer_name || 'Unknown payer'}</strong></div></td>
                            <td>{transaction.transaction_id || '—'}</td>
                            <td>{new Date(transaction.transaction_date).toLocaleDateString('en-IN')}</td>
                            <td className="amount-cell">{formatCurrency(Number(transaction.amount))}</td>
                            <td><span className={`status-badge ${transaction.duplicate_status ? 'pending' : 'verified'}`}><span />{transaction.duplicate_status ? 'Possible duplicate' : 'Recorded'}</span></td>
                            <td>{transaction.payment_method || '—'}</td>
                            <td>{transaction.reference_number || '—'}</td>
                            <td className="row-actions">
                              <button className="text-button" onClick={() => handleEditTransaction(transaction)}>Edit</button>
                              <button className="text-button danger-text" disabled={busy} onClick={() => handleDeleteTransaction(transaction)}>Delete</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {isReceiptPage && filteredReceipts.length === 0 && <div className="empty-state">No uploaded receipts found.</div>}
                  {!isReceiptPage && transactions.length === 0 && <div className="empty-state">No matching transactions found.</div>}
                </div>
                <div className="table-footer">
                  {isReceiptPage
                    ? `Showing ${filteredReceipts.length} of ${receipts.length} receipts`
                    : (
                      <div className="pagination">
                        <span>Page {page} · {transactions.length} transaction{transactions.length === 1 ? '' : 's'}</span>
                        <div>
                          <button className="secondary-button" disabled={page <= 1 || dataLoading} onClick={() => setPage(current => current - 1)}>Previous</button>
                          <button className="secondary-button" disabled={transactions.length < 20 || dataLoading} onClick={() => setPage(current => current + 1)}>Next</button>
                        </div>
                      </div>
                    )}
                </div>
              </section>
            </>
          )}
          <footer className="footer">© 2026 ReceiptIQ. Smart Receipt Scanning &amp; Payment Analysis.</footer>
        </div>
      </main>
    </div>
  )
}

export default App
