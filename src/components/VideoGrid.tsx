import { useState } from 'react';
import type { DeviceSummary } from '../types';
import { DeviceCard } from './DeviceCard';

interface Props {
  devices: DeviceSummary[];
  onDeviceClick: (device: DeviceSummary) => void;
  expandedDeviceId: string | null;
  gridCount: number;
}

export function VideoGrid({ devices, onDeviceClick, expandedDeviceId, gridCount }: Props) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(devices.length / gridCount));
  // Clamp so a smaller gridCount (fewer cells/page) never leaves us on an out-of-range page.
  const safePage = Math.min(page, totalPages - 1);
  const pageDevices = devices.slice(safePage * gridCount, (safePage + 1) * gridCount);
  const emptyCount = gridCount - pageDevices.length;

  return (
    <div className="video-grid-container">
      <div className={`video-grid grid-${gridCount} ${expandedDeviceId && pageDevices.some(d => d.deviceId === expandedDeviceId) ? 'has-expanded' : ''}`}>
        {pageDevices.map((device, i) => (
          <div
            key={device.deviceId}
            className={`grid-cell ${device.deviceId === expandedDeviceId ? 'expanded' : ''}`}
          >
            <DeviceCard
              device={device}
              index={safePage * gridCount + i}
              onClick={onDeviceClick}
            />
          </div>
        ))}
        {Array.from({ length: emptyCount }).map((_, i) => (
          <div key={`empty-${safePage}-${i}`} className="grid-cell">
            <div className="empty-cell" />
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Prev</button>
          <span>{safePage + 1} / {totalPages}</span>
          <button disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
