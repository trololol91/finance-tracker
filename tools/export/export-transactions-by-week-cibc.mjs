import fs from 'node:fs';
import path from 'node:path';

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function toISODate(date) {
  // Format as YYYY-MM-DD using UTC to avoid timezone issues
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfWeekMonday(date) {
  // Clone date and work in UTC to avoid timezone issues
  const dt = new Date(date.getTime());
  const day = dt.getUTCDay(); // 0=Sun,1=Mon,...
  const diff = (day + 6) % 7; // days since Monday
  dt.setUTCDate(dt.getUTCDate() - diff);
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
}

function endOfWeekSunday(date) {
  const start = startOfWeekMonday(date);
  const end = new Date(start.getTime());
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

function parseDate(value) {
  // Expect ISO with timezone, e.g. 2025-11-03T00:00:00-05:00
  return new Date(value);
}

function getAmount(tx) {
  const debit = tx.debit;
  const credit = tx.credit;
  // Positive for debit (money out), negative for credit (money in)
  if (debit != null) return Number(debit);
  if (credit != null) return -Number(credit);
  return 0;
}

function groupByWeek(transactions) {
  const map = new Map(); // key: weekStartISO, value: { start: Date, end: Date, items: [] }
  for (const tx of transactions) {
    const dt = parseDate(tx.date ?? tx.postedDate);
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
      const ad = parseDate(a.date ?? a.postedDate).getTime();
      const bd = parseDate(b.date ?? b.postedDate).getTime();
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
      const dt = parseDate(tx.date ?? tx.postedDate);
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
  const inputPath = path.join(root, 'transaction.json');
  if (!fs.existsSync(inputPath)) {
    console.error('transaction.json not found at repo root');
    process.exit(1);
  }
  const data = readJson(inputPath);
  const transactions = Array.isArray(data?.transactions) ? data.transactions : [];
  if (transactions.length === 0) {
    console.error('No transactions found in transaction.json');
    process.exit(1);
  }
  const weeks = groupByWeek(transactions);
  const tsv = toTsv(weeks);
  const outDir = path.join(root, 'exports');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'transactions_by_week_cibc.tsv');
  fs.writeFileSync(outFile, tsv, 'utf-8');
  console.log(`Wrote ${outFile}`);
}

main();