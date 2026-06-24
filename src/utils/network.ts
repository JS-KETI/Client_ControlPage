export function formatNetworkType(networkType: string | null): string {
  switch ((networkType ?? '').toUpperCase()) {
    case 'WIFI':
      return '📶 WiFi';
    case 'LTE':
      return '📡 LTE';
    case 'CELLULAR':
      return '📡 Cellular';
    default:
      return '-';
  }
}
