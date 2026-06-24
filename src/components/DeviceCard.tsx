import type { DeviceSummary } from '../types';
import { getBatteryColor, formatBps } from '../utils/battery';
import { networkBadge } from '../utils/network';
import { MoqVideo } from './MoqVideo';

interface Props {
  device: DeviceSummary;
  index: number;
  onClick: (device: DeviceSummary) => void;
}

export function DeviceCard({ device, index, onClick }: Props) {
  const batteryColor = getBatteryColor(device.battery);
  const net = networkBadge(device.networkType);

  return (
    <div className="device-card" onClick={() => onClick(device)}>
      <div className="card-header">
        <span className="device-label">#{index + 1} {device.deviceId}</span>
        <div className="card-header-right">
          <span className="battery" style={{ color: batteryColor }}>
            Battery {device.battery ?? '-'}%
          </span>
          <span className={`net-tag net-tag-${net.kind}`}>{net.label}</span>
        </div>
      </div>
      <div className="card-video">
        {device.relayUrl && device.broadcastPath ? (
          // key includes only streamRevision (true hard reconnect: full MoQ
          // teardown+reconnect) — that bump fully remounts the player. A
          // session-preserving QUIC path rebind (Wi-Fi↔Cellular, migrationRevision)
          // intentionally does NOT remount; it relies on the seamless migration
          // to keep frames flowing, with the no-progress watchdog as fallback.
          // relayUrl/broadcastPath unchanged.
          <MoqVideo
            key={`${device.deviceId}-${device.streamRevision ?? 0}`}
            relayUrl={device.relayUrl}
            broadcastPath={device.broadcastPath}
            deviceId={device.deviceId}
            streamRevision={device.streamRevision ?? 0}
            className="video-container"
          />
        ) : (
          <div className="video-placeholder">
            <span>{device.displayName}</span>
            <span className="resolution">{device.width}×{device.height} {device.fps}fps</span>
            <span className="bps">{formatBps(device.publisherTxBps)}</span>
          </div>
        )}
        <div className="video-overlay">
          <span className="bps">{formatBps(device.publisherTxBps)}</span>
        </div>
      </div>
      <div className="card-footer">
        <span className="location">
          {device.latitude != null && device.longitude != null
            ? `📍 ${device.latitude.toFixed(4)}, ${device.longitude.toFixed(4)}`
            : 'GPS 없음'}
        </span>
        <span className="status">{device.missionStatus === 'in_progress' ? 'On mission' : 'Idle'}</span>
      </div>
    </div>
  );
}
