/**
 * Standard Date and Excel utilities for Tanzil Microfinance
 */

/**
 * Format any date string (e.g. YYYY-MM-DD or ISO string or timestamp) to standard DD/MM/YYYY format.
 * Returns the original string if invalid or empty.
 */
export function formatDDMMYYYY(dateInput?: string | number | Date | null): string {
  if (!dateInput) return '';
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (!trimmed) return '';
    
    // Already DD/MM/YYYY or DD-MM-YYYY
    if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}/.test(trimmed)) {
      return trimmed.replace(/-/g, '/');
    }
    
    // YYYY-MM-DD or YYYY/MM/DD
    if (/^\d{4}[\/\-]\d{2}[\/\-]\d{2}/.test(trimmed)) {
      const parts = trimmed.split(/[\/\-T ]/);
      if (parts.length >= 3) {
        const yyyy = parts[0];
        const mm = parts[1];
        const dd = parts[2];
        return `${dd}/${mm}/${yyyy}`;
      }
    }
  }

  try {
    const dateObj = new Date(dateInput);
    if (isNaN(dateObj.getTime())) {
      return String(dateInput);
    }
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = dateObj.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return String(dateInput || '');
  }
}

/**
 * Download CSV/TSV content formatted for Excel with UTF-8 BOM so Bengali text renders perfectly.
 */
export function downloadExcelCsv(csvContent: string, filename: string): void {
  try {
    // Add UTF-8 BOM (\ufeff) so Microsoft Excel correctly displays Unicode / Bengali characters
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const cleanFilename = (filename || 'export').replace(/[^a-zA-Z0-9_\-\u0980-\u09FF]/g, '_');
    link.setAttribute('download', `${cleanFilename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.error('Failed to download excel csv', err);
  }
}
