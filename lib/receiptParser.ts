import { Receipt, LineItem } from './types';

const currencySymbols: Record<string, string> = {
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY'
};

function cleanLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

function parseMoney(value: string): number | null {
  const normalized = value.replace(/[^0-9.,-]/g, '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.');
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : null;
}

function extractCurrency(text: string): string {
  const symbol = Object.keys(currencySymbols).find((s) => text.includes(s));
  if (symbol) return currencySymbols[symbol];
  const code = text.match(/\b(USD|EUR|GBP|CAD|AUD|JPY|INR|MXN)\b/i)?.[1];
  return code ? code.toUpperCase() : 'USD';
}

function extractDate(lines: string[]): string {
  const patterns = [
    /\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b/,
    /\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/,
    /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4})\b/i
  ];

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const date = new Date(match[1]);
        if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
        return match[1];
      }
    }
  }
  return new Date().toISOString().slice(0, 10);
}

function extractMerchant(lines: string[]): string {
  const ignored = /receipt|invoice|order|tel|phone|date|time|cashier|welcome|tax|total|subtotal/i;
  const candidate = lines.find((line) => line.length >= 3 && /[A-Za-z]/.test(line) && !ignored.test(line));
  if (!candidate) return 'Unknown Merchant';
  return candidate.replace(/[^A-Za-z0-9 &'#.-]/g, '').trim();
}

function extractTotal(lines: string[]): number {
  const totalLines = lines.filter((line) => /\b(total|amount due|balance|paid)\b/i.test(line));
  for (let i = totalLines.length - 1; i >= 0; i--) {
    const matches = [...totalLines[i].matchAll(/[$€£¥]?\s*-?\d+[.,]\d{2}\b/g)];
    if (matches.length) {
      const parsed = parseMoney(matches[matches.length - 1][0]);
      if (parsed !== null) return parsed;
    }
  }

  const allAmounts = lines.flatMap((line) => [...line.matchAll(/[$€£¥]?\s*-?\d+[.,]\d{2}\b/g)].map((m) => parseMoney(m[0])).filter((n): n is number => n !== null));
  return allAmounts.length ? Math.max(...allAmounts) : 0;
}

function extractLineItems(lines: string[], total: number): LineItem[] {
  const skip = /\b(total|subtotal|tax|change|cash|visa|mastercard|amex|debit|credit|balance|amount due|paid|date|time)\b/i;
  const items: LineItem[] = [];

  for (const line of lines) {
    if (skip.test(line)) continue;
    const match = line.match(/(.+?)\s+[$€£¥]?\s*(-?\d+[.,]\d{2})\s*$/);
    if (!match) continue;
    const name = match[1].replace(/^[^A-Za-z0-9]+/, '').trim();
    const amount = parseMoney(match[2]);
    if (!name || amount === null || amount <= 0 || Math.abs(amount - total) < 0.01) continue;
    if (/[A-Za-z]/.test(name)) items.push({ name, amount });
  }

  return items.slice(0, 20);
}

function suggestCategory(text: string, merchant: string): string {
  const haystack = `${merchant} ${text}`.toLowerCase();
  const rules: Array<[string, string[]]> = [
    ['Meals & Dining', ['cafe', 'coffee', 'restaurant', 'pizza', 'burger', 'deli', 'bar', 'grill', 'bakery', 'taco', 'sushi', 'sandwich']],
    ['Groceries', ['grocery', 'market', 'supermarket', 'whole foods', 'trader joe', 'produce', 'milk', 'eggs', 'bread']],
    ['Travel', ['hotel', 'airline', 'uber', 'lyft', 'taxi', 'parking', 'train', 'flight', 'motel']],
    ['Office Supplies', ['office', 'staples', 'printer', 'paper', 'notebook', 'pen', 'ink']],
    ['Fuel & Auto', ['fuel', 'gas', 'shell', 'chevron', 'exxon', 'bp ', 'diesel']],
    ['Healthcare', ['pharmacy', 'clinic', 'doctor', 'medical', 'cvs', 'walgreens']],
    ['Utilities', ['electric', 'water', 'internet', 'phone bill', 'utility']]
  ];
  for (const [category, words] of rules) {
    if (words.some((word) => haystack.includes(word))) return category;
  }
  return 'General Expense';
}

export function parseReceiptText(rawText: string, imageUrl?: string): Receipt {
  const lines = rawText.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const text = lines.join('\n');
  const merchant = extractMerchant(lines);
  const purchaseDate = extractDate(lines);
  const total = extractTotal(lines);
  const currency = extractCurrency(text);
  const lineItems = extractLineItems(lines, total);
  const categorySuggestion = suggestCategory(text, merchant);

  return {
    id: crypto.randomUUID(),
    imageUrl,
    merchant,
    purchaseDate,
    total,
    currency,
    lineItems,
    categorySuggestion,
    createdAt: new Date().toISOString(),
    rawText
  };
}
