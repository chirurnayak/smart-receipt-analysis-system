
import { useMemo, useState } from 'react';
import './App.css';

type Receipt = {
  id: number;
  name: string;
  category: string;
  date: string;
  amount: number;
  status: string;
  method: string;
};

const initialReceipts: Receipt[] = [
  { id: 1, name: 'Stationery Purchase', category: 'Education', date: '2026-11-22', amount: 1250, status: 'Verified', method: 'UPI' },
  { id: 2, name: 'Event Decoration', category: 'Events', date: '2026-11-21', amount: 3500, status: 'Verified', method: 'Bank Transfer' },
  { id: 3, name: 'Printing Charges', category: 'Printing', date: '2026-11-20', amount: 850, status: 'Pending', method: 'UPI' },
  { id: 4, name: 'Food and Refreshments', category: 'Food', date: '2026-11-19', amount: 4200, status: 'Verified', method: 'Cash' },
  { id: 5, name: 'Project Materials', category: 'Education', date: '2026-11-18', amount: 2100, status: 'Pending', method: 'UPI' },
  { id: 6, name: 'Transportation', category: 'Travel', date: '2026-11-17', amount: 1800, status: 'Verified', method: 'Cash' },
];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

function App() {
  const [receipts, setReceipts] = useState(initialReceipts);
  const [activePage, setActivePage] = useState('Dashboard');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const total = receipts.reduce((sum, receipt) => sum + receipt.amount, 0);
  const verified = receipts.filter(r => r.status === 'Verified').length;
  const pending = receipts.filter(r => r.status === 'Pending').length;

  const filteredReceipts = useMemo(() => {
    return receipts.filter(receipt => {
      const matchesSearch =
        receipt.name.toLowerCase().includes(search.toLowerCase()) ||
        receipt.category.toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        category === 'All' || receipt.category === category;

      return matchesSearch && matchesCategory;
    });
  }, [receipts, search, category]);

  const navigation = [
    { name: 'Dashboard', icon: '▦' },
    { name: 'Upload Receipt', icon: '⇧' },
    { name: 'All Receipts', icon: '▤' },
    { name: 'Analytics', icon: '◫' },
    { name: 'Reports', icon: '▧' },
  ];

  const handleUpload = () => {
    if (!selectedFile) {
      alert('Please select a receipt file first.');
      return;
    }

    const newReceipt: Receipt = {
      id: Date.now(),
      name: selectedFile.name.replace(/\.[^/.]+$/, ''),
      category: 'Uncategorized',
      date: new Date().toISOString().slice(0, 10),
      amount: 0,
      status: 'Pending',
      method: 'Not specified',
    };

    setReceipts(previous => [newReceipt, ...previous]);
    setSelectedFile(null);
    setShowUpload(false);
    setActivePage('All Receipts');
    alert('Receipt uploaded successfully! Please review its details.');
  };

  const exportCSV = () => {
    const headings = ['Receipt', 'Category', 'Date', 'Amount', 'Status', 'Method'];
    const rows = receipts.map(r =>
      [r.name, r.category, r.date, r.amount, r.status, r.method]
        .map(value => `"${String(value).replace(/"/g, '""')}"`)
        .join(',')
    );

    const csv = [headings.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'receipt-report.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const pageTitle = activePage === 'Dashboard'
    ? 'Dashboard'
    : activePage;

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
                setActivePage(item.name);
                setShowUpload(item.name === 'Upload Receipt');
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
            <button onClick={() => alert('ReceiptIQ Support')}>Get Help →</button>
          </div>

          <div className="profile">
            <div className="avatar">A</div>
            <div className="profile-info">
              <strong>Admin User</strong>
              <span>Administrator</span>
            </div>
            <span className="profile-menu">•••</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span>/</span>
            <strong>{pageTitle}</strong>
          </div>
          <div className="topbar-right">
            <span className="date-label">
              {new Date().toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
            <button className="notification" aria-label="Notifications">♧</button>
            <div className="avatar small-avatar">A</div>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-section">
            <div>
              <p className="eyebrow">OVERVIEW</p>
              <h1>{pageTitle === 'Dashboard' ? 'Good day, Admin 👋' : pageTitle}</h1>
              <p className="subtitle">
                {pageTitle === 'Dashboard'
                  ? 'Here is what is happening with your receipts today.'
                  : `Manage and monitor your ${pageTitle.toLowerCase()} efficiently.`}
              </p>
            </div>

            <button
              className="primary-button"
              onClick={() => {
                setActivePage('Upload Receipt');
                setShowUpload(true);
              }}
            >
              <span>＋</span> Upload Receipt
            </button>
          </section>

          {activePage === 'Upload Receipt' || showUpload ? (
            <section className="panel upload-panel">
              <div className="section-heading">
                <div>
                  <h2>Upload a Receipt</h2>
                  <p>Add a receipt image or PDF to your records.</p>
                </div>
                <button className="close-button" onClick={() => {
                  setShowUpload(false);
                  setActivePage('Dashboard');
                }}>✕</button>
              </div>

              <label className="upload-zone">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                />
                <div className="upload-symbol">↑</div>
                <h3>{selectedFile ? selectedFile.name : 'Drag and drop your receipt here'}</h3>
                <p>Or click to browse files</p>
                <span>Supported formats: JPG, PNG, PDF</span>
              </label>

              {selectedFile && (
                <div className="selected-file">
                  <span>📄 {selectedFile.name}</span>
                  <button onClick={() => setSelectedFile(null)}>Remove</button>
                </div>
              )}

              <div className="upload-actions">
                <button className="secondary-button" onClick={() => setSelectedFile(null)}>Clear</button>
                <button className="primary-button" onClick={handleUpload}>Upload Receipt →</button>
              </div>
              <p className="notice">
                Note: Uploaded receipts are added as pending records. OCR and automatic payment extraction will be integrated in a later stage.
              </p>
            </section>
          ) : activePage === 'Reports' ? (
            <section className="panel report-panel">
              <div className="section-heading">
                <div>
                  <h2>Financial Reports</h2>
                  <p>Export your receipt records for further analysis.</p>
                </div>
              </div>
              <div className="report-summary">
                <div><span>Total receipts</span><strong>{receipts.length}</strong></div>
                <div><span>Total recorded amount</span><strong>{formatCurrency(total)}</strong></div>
                <div><span>Verified records</span><strong>{verified}</strong></div>
              </div>
              <button className="primary-button" onClick={exportCSV}>↓ Download CSV Report</button>
            </section>
          ) : (
            <>
              {activePage === 'Dashboard' && (
                <>
                  <section className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-top">
                        <span>Total Payments</span>
                        <span className="stat-icon blue">₹</span>
                      </div>
                      <h2>{formatCurrency(total)}</h2>
                      <p className="stat-foot">Across all recorded receipts</p>
                    </div>

                    <div className="stat-card">
                      <div className="stat-top">
                        <span>Total Receipts</span>
                        <span className="stat-icon purple">▤</span>
                      </div>
                      <h2>{receipts.length}</h2>
                      <p className="stat-foot">Uploaded receipt records</p>
                    </div>

                    <div className="stat-card">
                      <div className="stat-top">
                        <span>Verified Receipts</span>
                        <span className="stat-icon green">✓</span>
                      </div>
                      <h2>{verified}</h2>
                      <p className="stat-foot">Successfully reviewed</p>
                    </div>

                    <div className="stat-card">
                      <div className="stat-top">
                        <span>Pending Review</span>
                        <span className="stat-icon orange">◷</span>
                      </div>
                      <h2>{pending}</h2>
                      <p className="stat-foot">Awaiting verification</p>
                    </div>
                  </section>

                  <section className="analytics-grid">
                    <div className="panel chart-panel">
                      <div className="section-heading">
                        <div>
                          <h2>Payment Overview</h2>
                          <p>Recorded payment amounts by category</p>
                        </div>
                        <span className="period-tag">ALL TIME</span>
                      </div>

                      <div className="bar-chart">
                        {['Education', 'Events', 'Printing', 'Food', 'Travel'].map((name, index) => {
                          const amount = receipts
                            .filter(r => r.category === name)
                            .reduce((sum, r) => sum + r.amount, 0);
                          const maxAmount = Math.max(
                            1,
                            ...['Education', 'Events', 'Printing', 'Food', 'Travel'].map(c =>
                              receipts.filter(r => r.category === c)
                                .reduce((sum, r) => sum + r.amount, 0)
                            )
                          );

                          return (
                            <div className="bar-item" key={name}>
                              <div className="bar-value">{formatCurrency(amount)}</div>
                              <div className="bar-track">
                                <div
                                  className={`bar-fill bar-${index}`}
                                  style={{ height: `${Math.max(4, (amount / maxAmount) * 100)}%` }}
                                />
                              </div>
                              <span>{name}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="panel breakdown-panel">
                      <div className="section-heading">
                        <div>
                          <h2>Receipt Status</h2>
                          <p>Verification summary</p>
                        </div>
                      </div>
                      <div className="status-circle">
                        <div>
                          <strong>{receipts.length}</strong>
                          <span>Total</span>
                        </div>
                      </div>
                      <div className="status-legend">
                        <div><span className="legend-dot verified-dot" /> Verified <strong>{verified}</strong></div>
                        <div><span className="legend-dot pending-dot" /> Pending <strong>{pending}</strong></div>
                      </div>
                    </div>
                  </section>
                </>
              )}

              <section className="panel receipts-panel">
                <div className="section-heading">
                  <div>
                    <h2>{activePage === 'Analytics' ? 'Payment Records' : 'Recent Receipts'}</h2>
                    <p>View and manage your receipt transactions.</p>
                  </div>
                  <button className="text-button" onClick={() => setActivePage('All Receipts')}>
                    View all →
                  </button>
                </div>

                <div className="table-controls">
                  <div className="search-box">
                    <span>⌕</span>
                    <input
                      placeholder="Search receipts..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </div>
                  <select value={category} onChange={e => setCategory(e.target.value)}>
                    <option value="All">All Categories</option>
                    <option value="Education">Education</option>
                    <option value="Events">Events</option>
                    <option value="Printing">Printing</option>
                    <option value="Food">Food</option>
                    <option value="Travel">Travel</option>
                  </select>
                  <button className="secondary-button export-button" onClick={exportCSV}>
                    ↓ Export
                  </button>
                </div>

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>RECEIPT NAME</th>
                        <th>CATEGORY</th>
                        <th>DATE</th>
                        <th>AMOUNT</th>
                        <th>STATUS</th>
                        <th>PAYMENT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReceipts.map(receipt => (
                        <tr key={receipt.id}>
                          <td>
                            <div className="receipt-name">
                              <span className="receipt-icon">▤</span>
                              <strong>{receipt.name}</strong>
                            </div>
                          </td>
                          <td><span className="category-tag">{receipt.category}</span></td>
                          <td>{new Date(receipt.date + 'T00:00:00').toLocaleDateString('en-IN')}</td>
                          <td className="amount-cell">{formatCurrency(receipt.amount)}</td>
                          <td>
                            <span className={`status-badge ${receipt.status.toLowerCase()}`}>
                              <span />{receipt.status}
                            </span>
                          </td>
                          <td>{receipt.method}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredReceipts.length === 0 && (
                    <div className="empty-state">No matching receipts found.</div>
                  )}
                </div>
                <div className="table-footer">
                  Showing {filteredReceipts.length} of {receipts.length} receipts
                </div>
              </section>
            </>
          )}
          <footer className="footer">
            © 2026 ReceiptIQ. Smart Receipt Scanning & Payment Analysis.
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
