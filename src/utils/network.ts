export function formatNetworkType(networkType: string | null): string {
  switch ((networkType ?? '').toUpperCase()) {
    case 'WIFI':
      return '📶 WiFi';
    case '5G':
    case 'NR':
    case 'NR5G':
      return '📶 5G';
    case 'LTE':
      return '📡 LTE';
    case 'CELLULAR':
      return '📡 Cellular';
    default:
      return networkType ? `📡 ${networkType}` : '-';
  }
}
