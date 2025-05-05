/**
 * Utility functions for the funder module
 */

/**
 * Format a number as currency (ZAR)
 * @param value Number to format
 * @returns Formatted currency string
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

/**
 * Format a percentage value
 * @param value Number to format as percentage
 * @returns Formatted percentage string
 */
export const formatPercentage = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value / 100);
};

/**
 * Get color for status tag based on status value
 * @param status - Status string
 * @returns Color for the status tag
 */
export const getStatusColor = (status?: string): string => {
  if (!status) return 'default';
  
  switch (status.toLowerCase()) {
    case 'active':
    case 'funded':
    case 'performing':
      return 'green';
    case 'pending':
    case 'warning':
    case 'at risk':
    case 'underperforming':
      return 'orange';
    case 'closed':
    case 'exited':
      return 'blue';
    case 'rejected':
    case 'defaulted':
      return 'red';
    default:
      return 'default';
  }
}; 