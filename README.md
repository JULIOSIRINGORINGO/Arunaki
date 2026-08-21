<p align="center">
  <img src="docs/assets/logo.svg" alt="Arunaki Logo" width="96" height="96" />
</p>

<h1 align="center">Arunaki</h1>

<p align="center">
  <strong>The Desktop Document Agent & Automation Harness</strong><br>
  <em>Automate spreadsheets, daily reports, Word contracts, PowerPoint decks, and PDFs with minimal typing and visible desktop computer use.</em>
</p>

<p align="center">
  <a href="#-what-is-arunaki">What is Arunaki?</a> •
  <a href="#-the-philosophy-minimal-typing-maximum-automation">How It Works</a> •
  <a href="#-why-teams-choose-arunaki">Core Capabilities</a> •
  <a href="#-supported-documents">Supported Formats</a> •
  <a href="#-privacy--security">Security & Boundaries</a> •
  <a href="#-download">Download</a>
</p>

---

## 🌟 What is Arunaki?

**Arunaki** is an autonomous **Desktop Document Agent & Automation Harness** built specifically for office and business document operations. 

Instead of acting like a generic conversational bot or an abstract code runner, Arunaki acts as an execution harness that operates directly on document files inside your workspace: **updating Excel spreadsheets via native COM, editing Word documents, adding slides to PowerPoint presentations, merging and watermarking PDFs, redacting sensitive data, and calculating financial balances**.

Arunaki works with minimal human input—opening documents, executing precision modifications, preserving formulas, and recalculating totals—acting like a dedicated document specialist at your workstation.

---

## ⚡ The Philosophy: Minimal Typing, Maximum Automation

You shouldn't have to spend hours formatting tables, manually editing lines, or typing lengthy instructions. With Arunaki, you type the absolute minimum while the agent harness handles the execution:

- 📋 **Paste Raw Messages Directly**: Simply copy and paste messy WhatsApp order chats, raw supplier notes, or unstructured emails into Arunaki. The harness understands the context, structures the data, and maps everything automatically.
- 🎯 **3-Word Plain Instructions**: Just type brief natural instructions like `"Rekap ke excel"`, `"Update pengeluaran hari ini"`, or `"Sensor data pribadi kontrak"`. Arunaki automatically determines which file to open and which tools to execute.
- 🧮 **Autonomous Math & Formulas**: No need to build complex spreadsheet formulas or recalculate sums by hand. Arunaki automatically computes category breakdowns, bank transfer subtotals, cash in hand, and updates all dependent cells in a single pass.

---

## 🚀 Core Capabilities & Tool Harness

### 📊 Native Desktop Excel Automation
Arunaki interacts directly with spreadsheet files via headless COM automation. It writes to target cells (`B2`, `S4`, `S14`), preserves existing formulas (`=SUM(...)`), clones sheets, and maintains custom formatting and color styling 100% intact.

### 📝 Precision Word & Template Document Editing
Generate and modify professional business letters, official proposals, internal memos, and agreements in Microsoft Word format (`.docx`). Supports placeholder find-and-replace (`{{NAMA_KLIEN}}`), appending formatted paragraphs, and exporting to PDF.

### 📑 Presentation & Slide Authoring
Automate PowerPoint (`.pptx`) presentations by updating shape texts, adding structured slides with title and bullet points, and exporting presentation decks.

### 🛡️ Enterprise PDF Pipeline & Privacy Redaction
Full multi-stage PDF operations: merge multiple files, extract pages, apply diagonal custom watermarks, stamp signature images/e-Materai, and automatically redact sensitive PII (NIK KTP, NPWP, Bank Account, Phone Numbers).

### 🔍 Document Comparison & Redline Diffing
Performs line-by-line version comparisons between contract revisions, producing redline summary tables with similarity scores and clause change tracking.

### 🔌 Universal Model Routing
The Arunaki harness connects transparently to leading language models (DeepSeek, GPT, Claude, Gemini, or local private models) with automatic tool call repair and alias normalization.

---

## 📄 Supported Documents & Workflows

| Document Type | What the Arunaki Harness Automates |
| :--- | :--- |
| **Excel & Spreadsheets** (`.xlsx`, `.xls`, `.csv`) | Daily sales ledgers, inventory updates, financial reconciliations, multi-bank transfer tracking, customer order matrices. |
| **Word & Rich Text** (`.docx`, `.txt`, `.md`) | Business proposals, formal letters, agreements, template placeholder replacement, meeting minutes. |
| **PowerPoint Decks** (`.pptx`, `.ppt`) | Pitch decks, quarterly reports, automated slide generation with structured bullet points. |
| **PDF Documents** (`.pdf`) | Merging multiple invoices, page extraction, watermark stamping, digital signature placing, format conversion. |
| **Data & Financial Ledgers** (`.db`, `.sqlite`, `.json`) | Structured SQLite database queries, domain unit conversions (length, weight, currency), and communication drafting. |

---

## 🔒 Privacy & Workspace Isolation

Your business files stay strictly on your local machine.

- **Workspace Folder Isolation**: Arunaki is strictly locked inside the dedicated **Workspace Folder** you select. It cannot access your personal files, system configurations, or external folders.
- **No Unsafe Code Execution**: Arunaki operates exclusively through verified document tools and desktop office integrations—never executing arbitrary shell commands or installing untrusted software.
- **Automatic Backups & Rollback**: Built-in snapshot checkpoints allow you to restore original documents with a single click if needed.

---

## 📥 Download

*Native Desktop App installers for Windows and macOS are currently in active preparation.*

| Platform | Package | Status |
| :--- | :--- | :--- |
| **Windows** (10 / 11 64-bit) | `.exe` / `.msi` Installer | ⏳ *In Development* |
| **macOS** (Apple Silicon / Intel) | `.dmg` Package | ⏳ *In Development* |

---

## 📄 License

Copyright © 2026 Arunaki. All rights reserved.
