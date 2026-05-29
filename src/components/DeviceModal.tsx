import type { DeviceSummary } from '../types';
import { getBatteryColor, formatBps } from '../utils/battery';

interface Props {
  device: DeviceSummary;
  onClose: () => void;
}

export function DeviceModal({ device, onClose }: Props) {
  const batteryColor = getBatteryColor(device.battery);

  return (
    <div className="detail-panel-overlay" onClick={onClose}>
      <aside className="detail-panel" onClick={e => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose}>✕</button>
        <div className="panel-header">
          <span className="device-label">{device.deviceId}</span>
          <span style={{ color: batteryColor }}>Battery {device.battery != null ? `${device.battery}%` : '-'}</span>
          <span className="bps">{formatBps(device.publisherTxBps)}</span>
        </div>
        <div className="panel-body">
          <h3>Device Info</h3>
          <dl>
            <dt>deviceId</dt><dd>{device.deviceId}</dd>
            <dt>cameraId</dt><dd>{device.cameraId}</dd>
            <dt>streamId</dt><dd>{device.streamId}</dd>
          </dl>
          <h3>Video Info</h3>
          <dl>
            <dt>Resolution</dt><dd>{device.width} × {device.height}</dd>
            <dt>fps</dt><dd>{device.fps}</dd>
            <dt>Encoding</dt><dd>{device.encodingProfile}</dd>
          </dl>
          <h3>Status</h3>
          <dl>
            <dt>Battery</dt><dd style={{ color: batteryColor }}>{device.battery != null ? `${device.battery}%` : '-'}</dd>
            <dt>Location</dt><dd>{device.location ?? '-'}</dd>
            <dt>Mission</dt><dd>{device.missionId ?? '-'} ({device.missionStatus ?? '-'})</dd>
            <dt>Connected</dt><dd>{device.connectedAt ? new Date(device.connectedAt).toLocaleString() : '-'}</dd>
            <dt>Last seen</dt><dd>{device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : '-'}</dd>
          </dl>
          <h3>Relay</h3>
          <dl>
            <dt>URL</dt><dd>{device.relayUrl}</dd>
            <dt>Broadcast</dt><dd>{device.broadcastPath}</dd>
          </dl>
        </div>
      </aside>
    </div>
  );
}
