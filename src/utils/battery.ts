export function getBatteryColor(battery: number | null): string {
  if (battery === null) return '#999';
  if (battery > 50) return '#22c55e';
  if (battery > 15) return '#f97316';
  return '#ef4444';
}

export function formatBps(bps: number | null): string {
  if (bps === null) return '-';
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} Kbps`;
  return `${bps} bps`;
}
