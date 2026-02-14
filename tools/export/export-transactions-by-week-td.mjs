import fs from 'node:fs';
import path from 'node:path';

function readCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.trim().split('\n');
  const transactions = [];
  
  for (const line of lines) {
    // Parse CSV line (simple parser - assumes no commas in quoted fields)
    const parts = line.split(',');
    if (parts.length < 5) continue;
    
    const [dateStr, description, debitStr, creditStr, balanceStr] = parts;
    
    // Skip if date is invalid
    if (!dateStr || !dateStr.match(/\d{2}\/\d{2}\/\d{4}/)) continue;
    
    transactions.push({
      date: dateStr.trim(),
      transactionDescription: description.trim(),
      debit: debitStr.trim() || null,
      credit: creditStr.trim() || null,
      balance: balanceStr.trim() || null,
    });
  }
  
  return transactions;
}

function toISODate(date) {
  // Format as YYYY-MM-DD
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfWeekMonday(date) {
  // Clone date
  const dt = new Date(date.getTime());
  const day = dt.getDay(); // 0=Sun,1=Mon,...
  const diff = (day + 6) % 7; // days since Monday
  dt.setDate(dt.getDate() - diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function endOfWeekSunday(date) {
  const start = startOfWeekMonday(date);
  const end = new Date(start.getTime());
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function parseDate(value) {
  // Parse MM/DD/YYYY format
  const [month, day, year] = value.split('/').map(Number);
  return new Date(year, month - 1, day);
}

function getAmount(tx) {
  const debit = tx.debit;
  const credit = tx.credit;
  // Positive for debit (money out), negative for credit (money in)
  if (debit != null && debit !== '') return Number(debit);
  if (credit != null && credit !== '') return -Number(credit);
  return 0;
}

function groupByWeek(transactions) {
  const map = new Map(); // key: weekStartISO, value: { start: Date, end: Date, items: [] }
  for (const tx of transactions) {
    const dt = parseDate(tx.date);
    const start = startOfWeekMonday(dt);
    const key = toISODate(start);
    let entry = map.get(key);
    if (!entry) {
      entry = { start, end: endOfWeekSunday(start), items: [] };
      map.set(key, entry);
    }
    entry.items.push(tx);
  }
  // Sort weeks ascending by start
  const weeks = Array.from(map.values()).sort((a, b) => a.start - b.start);
  // Sort items within each week by date ascending, then description
  for (const w of weeks) {
    w.items.sort((a, b) => {
      const ad = parseDate(a.date).getTime();
      const bd = parseDate(b.date).getTime();
      if (ad !== bd) return ad - bd;
      return String(a.transactionDescription).localeCompare(String(b.transactionDescription));
    });
  }
  return weeks;
}

function toTsv(weeks) {
  const lines = [];
  for (const w of weeks) {
    const weekHeader = `Week ${toISODate(w.start)} to ${toISODate(w.end)}`;
    lines.push(weekHeader);
    lines.push('transactionDescription\tdate\tdebit/credit');
    for (const tx of w.items) {
      const desc = String(tx.transactionDescription ?? '');
      const dt = parseDate(tx.date);
      const dateStr = toISODate(dt);
      const amt = getAmount(tx);
      lines.push(`${desc}\t${dateStr}\t${amt}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function main() {
  const root = process.cwd();
  const inputPath = path.join(root, 'accountactivity.csv');
  if (!fs.existsSync(inputPath)) {
    console.error('accountactivity.csv not found at repo root');
    process.exit(1);
  }
  const transactions = readCsv(inputPath);
  if (transactions.length === 0) {
    console.error('No transactions found in accountactivity.csv');
    process.exit(1);
  }
  const weeks = groupByWeek(transactions);
  const tsv = toTsv(weeks);
  const outDir = path.join(root, 'exports');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'transactions_by_week_td.tsv');
  fs.writeFileSync(outFile, tsv, 'utf-8');
  console.log(`Wrote ${outFile}`);
}

main();
