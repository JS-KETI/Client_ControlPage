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

export type NetworkKind = 'wifi' | 'cellular' | 'unknown';

export interface NetworkBadge {
  label: string;
  kind: NetworkKind;
}

// 디바이스 카드 우측 상단 태그용: 아이콘 없는 라벨 + 색상 구분 kind.
// WiFi → 하늘색(wifi), LTE/5G/Cellular → 연두색(cellular), 그 외/없음 → 회색(unknown).
export function networkBadge(networkType: string | null): NetworkBadge {
  switch ((networkType ?? '').toUpperCase()) {
    case 'WIFI':
      return { label: 'WiFi', kind: 'wifi' };
    case '5G':
    case 'NR':
    case 'NR5G':
      return { label: '5G', kind: 'cellular' };
    case 'LTE':
      return { label: 'LTE', kind: 'cellular' };
    case 'CELLULAR':
      return { label: 'Cellular', kind: 'cellular' };
    default:
      return networkType ? { label: networkType, kind: 'unknown' } : { label: '-', kind: 'unknown' };
  }
}
