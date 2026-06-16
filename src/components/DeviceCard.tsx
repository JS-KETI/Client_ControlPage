import type { DeviceSummary } from '../types';
import { getBatteryColor, formatBps } from '../utils/battery';
import { MoqVideo } from './MoqVideo';

interface Props {
  device: DeviceSummary;
  index: number;
  onClick: (device: DeviceSummary) => void;
}

export function DeviceCard({ device, index, onClick }: Props) {
  const batteryColor = getBatteryColor(device.battery);

  return (
    <div className="device-card" onClick={() => onClick(device)}>
      <div className="card-header">
        <span className="device-label">#{index + 1} {device.deviceId}</span>
        <span className="battery" style={{ color: batteryColor }}>
          Battery {device.battery ?? '-'}%
        </span>
      </div>
      <div className="card-video">
        {device.relayUrl && device.broadcastPath ? (
          // key includes streamRevision (hard reconnect) AND migrationRevision
          // (session-preserving QUIC rebind) so EITHER bump fully remounts the
          // player instead of staying frozen on the last frame. The watchdog
          // remains as a no-progress fallback. relayUrl/broadcastPath unchanged.
          <MoqVideo
            key={`${device.deviceId}-${device.streamRevision ?? 0}-${device.migrationRevision ?? 0}`}
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
        <span className="location">{device.location ?? 'Location unknown'}</span>
        <span className="status">{device.missionStatus === 'in_progress' ? 'On mission' : 'Idle'}</span>
      </div>
    </div>
  );
}
