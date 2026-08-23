# ARUNAKI – Operational Rulebook  
*Version 1.4 – August 2026*  

---  

## 1. Domain Overview  

| Aspect | Description |
|--------|-------------|
| **Business** | Automotive workshop (bengkel) handling parts sales, service jobs, and inventory management. |
| **Primary Documents** | • **Sales reports** – Excel files named `Laporan Bengkel <Month>.xlsx` (e.g., `Laporan Bengkel Januari.xlsx`). <br>• **Inventory sheets** – Excel/CSV files tracking stock levels. <br>• **Service orders** – Word/Excel or PDF forms capturing job details, labor, and parts used. |
| **Key Entities** | **Date**, **Item (Barang)**, **Quantity (Jumlah)**, **Unit Price (Harga)**, **Line Total (Total)**, **Customer**, **Vehicle**, **Mechanic**, **Invoice Number**. |
| **Workflow** | 1. **Capture transaction** (sale or service) → 2. **Log to daily sheet** → 3. **Aggregate to monthly "Laporan Bengkel"** → 4. **Update inventory** → 5. **Generate invoice / receipt** → 6. **Archive**. |

---  

## 2. File Naming & Schema Conventions  

| File Type | Naming Pattern | Required Columns / Fields |
|-----------|----------------|---------------------------|
| **Monthly Sales Report** | `Laporan Bengkel <Month>.xlsx` (Month in Bahasa Indonesia, e.g., `Januari`, `Februari`) | One workbook that may contain multiple **Penjualan <Month>** sheets (one per month) plus shared **Stok** and **Rekap** sheets. <br><br>**Penjualan <Month>** – Transaction log with columns:<br>`Tanggal` (DD/MM/YYYY)<br>`Barang` (string)<br>`Jumlah` (integer)<br>`Harga` (integer, IDR)<br>`Total` (integer, auto-calc = `Jumlah * Harga`)。<br><br>**Stok** – Per-item stock tracker with columns:<br>`Kode`, `Barang`, `Awal`, `Masuk`, `Keluar`, `Sisa`<br>Synchronized with every sale and service parts deduction.<br><br>**Rekap** – Mandatory monthly summary with columns:<br>`Keterangan`, `Nilai`<br>Rows for `Total Penjualan` (sum of `Total` from Penjualan) and `Jumlah Transaksi` (row count of Penjualan). Written to after each sales update.<br><br>*Formatting rule: In all sheets, the header row (row 1) must be bold.* |
| **Monthly Rekap PDF** | `Laporan Bengkel <Month> - Rekap.pdf` | PDF version of the **Rekap** sheet, generated automatically after the Rekap is written. |
| **Inventory Ledger** | `Inventaris <Year>.xlsx` | Columns: `Barang`, `Stok Awal`, `Masuk`, `Keluar`, `Stok Akhir`. |
| **Service Order** | `Service_<YYYYMMDD>_<Seq>.xlsx` | Columns: `Tanggal`, `No. Service`, `Kendaraan`, `Pemilik`, `Kerusakan`, `Barang Dipakai`, `Jumlah`, `Harga`, `Total`, `Mekanik`. |
| **Invoice** | `Invoice_<No>.pdf` | Fields: `No. Invoice`, `Tanggal`, `Kepada`, `Rincian Barang`, `Subtotal`, `PPN`, `Total Bayar`. |

*All numeric values are stored as plain integers (no thousand separators) to simplify parsing.*  

---  

## 3. Cross‑File Relationships  

1. **Sales → Inventory (Stok sheet)**  
   - Every row added to **Penjualan <Month>** reduces the corresponding `Barang` in the **Stok** sheet: `Keluar` += `Jumlah`, then `Sisa` is recomputed.
2. **Service Order → Inventory**  
   - Parts listed under `Barang Dipakai` are deducted from the **Stok** sheet (and `Inventaris` ledger) in the same way as sales.
3. **Monthly Report → Invoice Generation**  
   - At month‑end, the sum of `Total` per `Barang` from the **Penjualan** sheet is used to auto‑populate a bulk invoice for wholesale customers.
4. **Rekap Sync**  
   - The **Rekap** sheet must be kept in sync after every sales update: recompute `Total Penjualan` and `Jumlah Transaksi` and rewrite both values.

---  

## 4. Automation Rules  

### 4.1 When to **Read** a Document  

| Trigger | Action |
|---------|--------|
| **User asks for "sales today", "stock level of X", or "service history"** | Load the latest **Penjualan** sheet (or the specific date range) and/or the **Inventaris** file. |
| **User requests "monthly summary" or "rekap bulanan"** | Read the current month's `Laporan Bengkel <Month>.xlsx`. Calculate: (1) total sales amount (sum of all `Total` column values) and (2) total number of transactions (count of rows in **Penjualan** sheet). **Then write these calculated values into the Rekap sheet using the appropriate tool – do not merely verify them.** After writing the Rekap sheet, generate the PDF version `Laporan Bengkel <Month> - Rekap.pdf` automatically. |
| **User uploads a new service order file** | Read the file to extract parts usage and labor for inventory update. |
| **User asks for "invoice #123"** | Open the corresponding PDF (if stored) or regenerate from the underlying data. |

### 4.2 When to **Create** a New File  

| Condition | File Created | Content |
|-----------|--------------|---------|
| First transaction of a new month | `Laporan Bengkel <Month>.xlsx` | New workbook with one **Penjualan <Month>** sheet, plus shared **Stok** and **Rekap** sheets. Header rows bolded; auto‑calc logic for `Total` in Penjualan. |
| New month begins and the monthly report workbook already exists | Add a new monthly **Penjualan** sheet to the existing workbook (e.g., **Penjualan Februari**). Preserve all existing sheet data, column structure, header formatting, and auto‑calc logic from previous sheets. Do not duplicate **Stok** or **Rekap** sheets. |
| First transaction of a new year | `Inventaris <Year>.xlsx` | New inventory ledger with opening balances (copied from previous year's `Stok Akhir`). |
| New service job (date not yet represented) | `Service_<YYYYMMDD>_<Seq>.xlsx` | Blank template populated with date and auto‑incremented sequence. |
| End‑of‑month bulk billing request | `Invoice_<No>.pdf` | Auto‑generated PDF using aggregated sales data. |

### 4.3 When to **Edit Surgically**  

*When a user requests modifications to a file, you must actually execute the appropriate tool to apply the changes, not just describe them.*

| Situation | Target | Edit Scope |
|-----------|--------|------------|
| **Add a new sale line or correct a quantity error** | Current month's **Penjualan** sheet | Append a new row or update the specific row's `Jumlah`; recalculate `Total` (formula `=C*D`). Then update **Stok** (`Keluar` and `Sisa`) and rewrite **Rekap** aggregates. |
| **Adjust inventory after a return** | **Inventaris** ledger | Increment `Masuk` for the returned `Barang`; recompute `Stok Akhir`. |
| **Amend a service order** | Specific **Service** sheet | Update relevant fields (e.g., `Jumlah`, `Harga`, `Total`) and recompute totals. |

---  

## 5. Excel Edit Discipline (MANDATORY)  

1. NEVER write to a sheet without confirming it exists and matches the data intent. Call `list_sheets` (or read the sheets list from any tool result) first if unsure.  
2. Sales/transaction rows go to the **Penjualan <Month>** sheet. Monthly aggregates go to the **Rekap** sheet. Stock movements (`Keluar`/`Sisa`) go to the **Stok** sheet. Never mix them.  
3. Before writing cells, `read_range` the target sheet to confirm header positions.  
4. After finishing all writes, re-read the modified range to verify values landed correctly before answering the user. If wrong, fix immediately.

## User Preferences & Learned Corrections
- [Auto-Learned 2026-08-23]: Multiple monthly sheets (e.g., Penjualan Januari, Penjualan Februari) coexist in the same workbook file; appending a new month's sheet while preserving all previous data.
