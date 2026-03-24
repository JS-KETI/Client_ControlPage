import type { DeviceSummary } from '../types';
import { getBatteryColor, formatBps } from '../utils/battery';
import { MoqVideo } from './MoqVideo';

interface Props {
  device: DeviceSummary;
  onClose: () => void;
}

export function DeviceModal({ device, onClose }: Props) {
  const batteryColor = getBatteryColor(device.battery);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="modal-layout">
          <div className="modal-video">
            <div className="modal-status-bar">
              <span>{formatBps(device.publisherTxBps)}</span>
              <span>{device.deviceId}</span>
              <span style={{ color: batteryColor }}>배터리 {device.battery ?? '-'}%</span>
              <span>{device.location ?? '-'}</span>
              <span>{device.missionStatus === 'in_progress' ? '임무 수행 중' : '대기 중'}</span>
            </div>
            {device.relayUrl && device.broadcastPath ? (
              <MoqVideo
                relayUrl={device.relayUrl}
                broadcastPath={device.broadcastPath}
                deviceId={device.deviceId}
                className="video-container large"
              />
            ) : (
              <div className="video-placeholder large">
                <span>{device.displayName}</span>
                <span>{device.width}×{device.height} {device.fps}fps</span>
              </div>
            )}
          </div>
          <div className="modal-detail">
            <h3>기기 정보</h3>
            <dl>
              <dt>deviceId</dt><dd>{device.deviceId}</dd>
              <dt>cameraId</dt><dd>{device.cameraId}</dd>
              <dt>streamId</dt><dd>{device.streamId}</dd>
            </dl>
            <h3>영상 정보</h3>
            <dl>
              <dt>해상도</dt><dd>{device.width} × {device.height}</dd>
              <dt>fps</dt><dd>{device.fps}</dd>
              <dt>인코딩</dt><dd>{device.encodingProfile}</dd>
            </dl>
            <h3>상태 정보</h3>
            <dl>
              <dt>배터리</dt><dd style={{ color: batteryColor }}>{device.battery ?? '-'}%</dd>
              <dt>위치</dt><dd>{device.location ?? '-'}</dd>
              <dt>임무</dt><dd>{device.missionId ?? '-'} ({device.missionStatus ?? '-'})</dd>
              <dt>연결</dt><dd>{device.connectedAt ? new Date(device.connectedAt).toLocaleString() : '-'}</dd>
              <dt>최근 응답</dt><dd>{device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : '-'}</dd>
            </dl>
            <h3>Relay</h3>
            <dl>
              <dt>URL</dt><dd>{device.relayUrl}</dd>
              <dt>Broadcast</dt><dd>{device.broadcastPath}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
