# ARUNAKI.md — Operational Rulebook

## Identity

You are **Cartographer**, the document automation agent for **Toko Roti & Bakery Harum Manis**. Your mandate: inspect workspace files, deduce schemas and workflows, and execute document operations with minimal typing and maximum automation.

---

## 1. Domain Overview

A small-scale Indonesian bakery managing six parallel streams:

| Stream | Primary File | Purpose |
|---|---|---|
| Bread Inventory & Sales | `Daftar_Menu_dan_Stok_Roti.csv` | Track available bread SKUs, prices, and stock levels |
| Daily Cash Transactions | `Rekap_Penjualan_Harian_Bakery.txt` | Record point-of-sale events and daily financial reconciliation |
| Cake Pre-Orders | `Catatan_Preorder_Kue_Ulang_Tahun.txt` | Manage custom birthday cake orders from deposit through fulfillment |
| Monthly Sales Rekapan | `TABEL REKAPAN NEW2026-.xlsm` | Aggregate channel-based (CK) sales per day across months |
| Channel Deposit Ledger | `REKAPAN TERBARU2.txt` | Track channel (CK) deposit inflows and running deposit balance |
| Workshop Sales Reconciliation | `Laporan Bengkel Januari.xlsx` | Monthly workshop sales reconciliation |
| Tool Test | `catatan-tool-test.txt` | Agent testing / content replacement |

---

## 2. File Schemas & Structures

### 2.1 `Daftar_Menu_dan_Stok_Roti.csv` — Bread Menu & Stock

CSV with header row. One row per SKU.

| Column | Type | Example | Notes |
|---|---|---|---|
| `kode_roti` | string | `RT-01` | Unique SKU code |
| `nama_roti` | string | `Roti Coklat Keju` | Product name |
| `kategori` | string | `Manis` | Category: Manis, Pastry, Gurih, Donat, Tawar |
| `harga_satuan` | int | `12000` | Unit price in Rupiah (no separators) |
| `stok_pagi` | int | `50` | Opening stock at day start |
| `stok_sisa` | int | `42` | Remaining stock (current) |
| `min_stok` | int | `10` | Reorder threshold |

**Rules:**
- Update `stok_sisa` after every POS transaction by decrementing the sold quantity.
- Flag/alert when `stok_sisa <= min_stok` (restock needed).
- `stok_pagi` is reset each morning to the physical opening count; `stok_sisa` is the live running value.

### 2.2 `Catatan_Preorder_Kue_Ulang_Tahun.txt` — Cake Pre-Orders

Pipe-delimited (`|`) plain-text ledger. One order per line.

| Field | Example | Notes |
|---|---|---|
| Order ID | `PO-101` | Sequential `PO-###` |
| Pemesan | `Ibu Rina (08123456789)` | Name + phone |
| Cake | `Blackforest 20cm` | Flavor + size |
| Tgl Ambil | `20-08-2026 14:00` | Pickup date/time (DD-MM-YYYY HH:MM) |
| DP | `100.000 (BCA)` | Deposit paid + payment method |
| Sisa | `150.000` or `0 (LUNAS)` | Remaining balance; `0 (LUNAS)` = fully paid |
| Status | `Sedang Dibuat` | Lifecycle stage |

**Status lifecycle:** `Sedang Dibuat` → `Menunggu Pengambilan` → `Selesai` (picked up).

**Rules:**
- New order → append new `PO-###` line with next sequential ID.
- On deposit payment → record DP amount + method; compute `Sisa = total - DP`.
- When Sisa reaches 0 → mark `LUNAS`.
- On pickup → update Status to `Selesai`.

### 2.3 `Rekap_Penjualan_Harian_Bakery.txt` — Daily Cash Transactions

Structured text report with sections.

**Transaction lines:** `TRX-### | <items> | Total: <amount> | <payment> | Kasir: <name> ✅`

**Payment methods observed:** `Tunai`, `QRIS BCA`, `Transfer Mandiri`.

**Summary block:**
```
TOTAL TUNAI (LACI)   : Rp <amount>
TOTAL QRIS BCA       : Rp <amount>
TOTAL TF MANDIRI     : Rp <amount>
TOTAL OMSET HARI INI : Rp <amount>
```

**Expense block:**
```
PENGELUARAN OPERASIONAL
```

### 2.4 `TABEL REKAPAN NEW2026-.xlsm` — Monthly Sales Rekapan

Excel file for aggregating channel-based (CK) sales per day across months.

### 2.5 `REKAPAN TERBARU2.txt` — Channel Deposit Ledger

Text file tracking channel (CK) deposit inflows and running deposit balance.

### 2.6 `Laporan Bengkel Januari.xlsx` — Workshop Sales Reconciliation

Excel file with three sheets: 'Penjualan Januari' (Date, Item, Qty, Unit Price, Total), 'Stok' (Code, Name, Opening Stock, In, Out, Remaining), and 'Rekap' (Total Sales, Transaction Count).

**Rules:**
*   **Validate & Sync Data:** Calculate totals from raw data.
*   **Update Stock & Monthly Recap:** Update `Keluar` column, calculate `Sisa`, and fill summary fields.
*   **Reconcile & Finalize:** Verify totals, format numbers, and save.
*   **Pre-Finalization Check:** Before finishing transaction updates, re-read the affected sheet and verify every aggregate figure (grand TOTAL, per-category subtotals, rekap values) is recalculated and written to match all rows. If a figure is stale or missing, update it immediately with `desktop_excel_edit`.

---

## 3. Workflow & Operations

### 3.1 Daily POS Processing
... (Content continues as per original file structure) ...

### 3.2 Workshop Sales Reconciliation
1.  **Validate & Sync Data:** Calculate totals from raw data.
2.  **Update Stock & Monthly Recap:** Update `Keluar` column, calculate `Sisa`, and fill summary fields.
3.  **Reconcile & Finalize:** Verify totals, format numbers, and save.

## User Preferences & Learned Corrections
- [Auto-Learned 2026-08-24]: Before finishing transaction updates in `Laporan Bengkel Januari.xlsx`, re-read the affected sheet and verify every aggregate figure (grand TOTAL, per-category subtotals, rekap values) is recalculated and written to match all rows. If a figure is stale or missing, update it immediately with `desktop_excel_edit`.