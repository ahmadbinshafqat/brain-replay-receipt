'use client';

import { useMemo, useState } from 'react';
import { createWorker } from 'tesseract.js';
import type { Receipt } from '@/lib/types';

const sampleReceipt = `SUNRISE CAFE
123 Market Street
San Francisco, CA
Date: 2024-06-17  Time: 09:42
Latte                 $4.75
Breakfast Sandwich    $8.50
Orange Juice          $3.25
Subtotal             $16.50
Tax                   $1.49
TOTAL                $17.99
Paid Visa            $17.99`;

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount || 0);
}

export default function Home() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Replay Receipt';
  const [rawText, setRawText] = useState('');
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const canParse = useMemo(() => rawText.trim().length > 0 && !busy, [rawText, busy]);

  async function handleImage(file: File | undefined) {
    if (!file) return;
    setError('');
    setReceipt(null);
    const localUrl = URL.createObjectURL(file);
    setImageUrl(localUrl);
    setBusy(true);
    setStatus('Reading receipt image with local OCR. This can take 10-30 seconds...');

    try {
      const worker = await createWorker('eng');
      const result = await worker.recognize(file);
      await worker.terminate();
      const text = result.data.text.trim();
      setRawText(text);
      setStatus(text ? 'OCR complete. Review the extracted text, then generate the summary.' : 'OCR finished, but no text was found. Try a clearer image or paste text.');
    } catch (err) {
      setError('OCR failed in the browser. Please try a clearer image or paste the receipt text manually.');
      setStatus('');
    } finally {
      setBusy(false);
    }
  }

  async function parseReceipt() {
    setBusy(true);
    setError('');
    setStatus('Structuring receipt...');
    try {
      const response = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText, imageUrl })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to parse receipt.');
      setReceipt(data);
      setStatus('Summary ready.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to parse receipt.');
      setStatus('');
    } finally {
      setBusy(false);
    }
  }

  function loadSample() {
    setRawText(sampleReceipt);
    setImageUrl(undefined);
    setReceipt(null);
    setError('');
    setStatus('Sample receipt loaded. Click Generate summary.');
  }

  return (
    <main className="page">
      <div className="shell">
        <section className="hero">
          <div>
            <span className="badge">finance-lite · local OCR</span>
            <h1>{appName}</h1>
            <p className="lede">
              Upload or paste a receipt and get a reimbursement-ready expense summary with merchant, date, total, line items, and a suggested category.
            </p>
          </div>
          <div className="card">
            <strong>What this MVP extracts</strong>
            <p className="sample">Merchant, purchase date, total, currency, itemized lines, and category suggestion — all rendered on this page.</p>
          </div>
        </section>

        <section className="grid">
          <div className="card">
            <h2>1. Add a receipt</h2>
            <div className="uploader">
              <input className="file-input" type="file" accept="image/*" onChange={(e) => handleImage(e.target.files?.[0])} disabled={busy} />
              {imageUrl ? <img className="preview" src={imageUrl} alt="Uploaded receipt preview" /> : <p className="sample">Choose a clear receipt image, or paste text below.</p>}
            </div>

            <h2>2. Review extracted text</h2>
            <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} placeholder="Paste receipt text here, or upload an image to run OCR..." />

            <div className="actions">
              <button className="primary" onClick={parseReceipt} disabled={!canParse}>Generate summary</button>
              <button className="secondary" onClick={loadSample} disabled={busy}>Load sample</button>
            </div>
            {status ? <div className="status">{status}</div> : null}
            {error ? <div className="error">{error}</div> : null}
          </div>

          <div className="card">
            <h2>Expense summary</h2>
            {receipt ? (
              <div>
                <div className="summary-head">
                  <div>
                    <div className="merchant">{receipt.merchant}</div>
                    <div className="meta">Purchased on {receipt.purchaseDate}</div>
                    <div className="category">{receipt.categorySuggestion}</div>
                  </div>
                  <div>
                    <div className="total">{formatMoney(receipt.total, receipt.currency)}</div>
                    <div className="meta">{receipt.currency}</div>
                  </div>
                </div>
                <div className="items">
                  <h3>Line items</h3>
                  {receipt.lineItems.length ? receipt.lineItems.map((item, index) => (
                    <div className="item" key={`${item.name}-${index}`}>
                      <span className="item-name">{item.name}</span>
                      <span className="item-price">{formatMoney(item.amount, receipt.currency)}</span>
                    </div>
                  )) : <p className="sample">No itemized lines were confidently detected. The total and merchant were still extracted.</p>}
                </div>
                <p className="sample">Receipt ID: {receipt.id}<br />Created: {new Date(receipt.createdAt).toLocaleString()}</p>
              </div>
            ) : (
              <div className="empty">Your structured receipt will appear here after upload/OCR and parsing.</div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
