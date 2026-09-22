/**
 * Standard Excel and CSV Export Engine for Microfinance & Cooperative Reports
 * Supports full Bengali Unicode (UTF-8 BOM), structured organizational headers,
 * dynamic organization naming, and branch/date metadata.
 */

import { formatDDMMYYYY } from './dateUtils';

export interface ReportExcelHeaderOptions {
  orgName: string;
  branchName?: string;
  reportTitle: string;
  dateRangeText?: string;
  startDate?: string;
  endDate?: string;
  downloadTime?: string;
  samityName?: string;
  preparedBy?: string;
  extraDetails?: { label: string; value: string | number }[];
  headers: string[];
  rows: (string | number | null | undefined)[][];
  summaryRows?: (string | number | null | undefined)[][];
}

/**
 * Format current date & time in standard Bengali / readable format
 */
export function getCurrentExportDateTime(): string {
  const now = new Date();
  const dateStr = formatDDMMYYYY(now);
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  const formattedHours = String(hours).padStart(2, '0');
  return `${dateStr}, ${formattedHours}:${minutes} ${ampm}`;
}

/**
 * Generate a clean, file-system safe filename starting with Organization Name,
 * completely excluding any software name.
 */
export function generateExcelFilename(orgName: string, reportTitle: string, datePart?: string): string {
  // 1. Clean organization name (remove any accidental default software keyword)
  let cleanOrg = (orgName || 'প্রতিষ্ঠান')
    .replace(/tanzil|software|microfinance|app/gi, '')
    .trim();
  if (!cleanOrg) {
    cleanOrg = orgName?.trim() || 'প্রতিষ্ঠান';
  }

  // 2. Remove invalid filename characters while preserving Bengali Unicode (\u0980-\u09FF)
  const sanitize = (text: string) => {
    return text
      .replace(/[\/\\?%*:|"<>#~`!@$^&+=;,]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
  };

  const orgClean = sanitize(cleanOrg);
  const titleClean = sanitize(reportTitle || 'রিপোর্ট');
  const dateClean = datePart ? sanitize(datePart) : formatDDMMYYYY(new Date()).replace(/[\/\\]/g, '-');

  return `${orgClean}_${titleClean}_${dateClean}`;
}

/**
 * Escape a value for CSV cell formatting
 */
export function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) {
    return '""';
  }
  const str = String(val).trim();
  // Double quotes inside string need to be doubled in CSV
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Universal Excel CSV Downloader with UTF-8 BOM so Microsoft Excel,
 * Google Sheets, and LibreOffice correctly render Bengali and Unicode characters.
 */
export function downloadExcelCsv(csvContent: string, filename: string): void {
  try {
    // Add UTF-8 BOM (\ufeff)
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);

    // Clean filename
    let cleanFilename = (filename || 'export')
      .replace(/[\/\\?%*:|"<>]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_');
    if (cleanFilename.endsWith('.csv')) {
      cleanFilename = cleanFilename.slice(0, -4);
    }

    link.setAttribute('download', `${cleanFilename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch (err) {
    console.error('Failed to download excel csv', err);
  }
}

/**
 * Export any financial or operational report to Excel with a complete,
 * beautifully structured organizational header containing:
 * - প্রতিষ্ঠানের নাম (Organization Name)
 * - ব্রাঞ্চের নাম (Branch Name)
 * - রিপোর্টের নাম (Report Title)
 * - তারিখ টু তারিখ (Date to Date Range)
 * - ডাউনলোড তারিখ ও সময় (Download Date & Time)
 * - সমিতি / দল (Samity / Group, if available)
 * - প্রস্তুতকারক (Prepared By, if available)
 * - Blank row separator
 * - Table Column Headers
 * - Data Rows
 * - Summary / Total Rows
 */
export function exportReportToExcel(options: ReportExcelHeaderOptions): void {
  const {
    orgName,
    branchName,
    reportTitle,
    dateRangeText,
    startDate,
    endDate,
    downloadTime,
    samityName,
    preparedBy,
    extraDetails = [],
    headers,
    rows,
    summaryRows = []
  } = options;

  // Compute date range text
  let finalDateRange = dateRangeText;
  if (!finalDateRange) {
    if (startDate && endDate) {
      const s = formatDDMMYYYY(startDate);
      const e = formatDDMMYYYY(endDate);
      finalDateRange = s === e ? `তারিখ: ${s}` : `${s} হতে ${e}`;
    } else if (startDate) {
      finalDateRange = `তারিখ: ${formatDDMMYYYY(startDate)}`;
    } else {
      finalDateRange = `তারিখ: ${formatDDMMYYYY(new Date())}`;
    }
  }

  const exportTime = downloadTime || getCurrentExportDateTime();

  // Build Header Rows in CSV format
  const headerBlock: string[][] = [
    ['প্রতিষ্ঠানের নাম (Organization):', orgName || 'মাইক্রোফাইন্যান্স সমবায় সমিতি'],
    ['শাখা / ব্রাঞ্চ (Branch):', branchName || 'সকল শাখা / প্রধান কার্যালয়'],
    ['প্রতিবেদনের বিষয় (Report Title):', reportTitle],
    ['সময়কাল / তারিখ (Date Range):', finalDateRange],
    ['ডাউনলোড তারিখ ও সময় (Exported At):', exportTime]
  ];

  if (samityName && samityName !== 'all' && samityName !== 'সকল সমিতি') {
    headerBlock.push(['সমিতি / কেন্দ্র (Samity/Group):', samityName]);
  }

  if (preparedBy) {
    headerBlock.push(['প্রস্তুতকারক (Prepared By):', preparedBy]);
  }

  if (extraDetails && extraDetails.length > 0) {
    extraDetails.forEach(item => {
      if (item && item.label) {
        headerBlock.push([`${item.label}:`, String(item.value ?? '')]);
      }
    });
  }

  // Blank separator row before table
  headerBlock.push(['']);

  // Convert Header Block to CSV lines
  const headerLines = headerBlock.map(r => r.map(escapeCsvCell).join(','));

  // Table Column Headers line
  const tableHeadersLine = headers.map(escapeCsvCell).join(',');

  // Table Data Rows
  const dataLines = rows.map(row => row.map(escapeCsvCell).join(','));

  // Summary Rows (if any)
  const summaryLines = summaryRows.map(row => row.map(escapeCsvCell).join(','));

  // Combine everything
  const allLines = [
    ...headerLines,
    tableHeadersLine,
    ...dataLines,
    ...summaryLines
  ];

  const csvContent = allLines.join('\r\n');

  // Generate Filename starting with Organization Name
  const filename = generateExcelFilename(orgName, reportTitle, finalDateRange);

  // Trigger download
  downloadExcelCsv(csvContent, filename);
}
