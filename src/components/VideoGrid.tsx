import { useState } from 'react';
import type { DeviceSummary } from '../types';
import { DeviceCard } from './DeviceCard';

interface Props {
  devices: DeviceSummary[];
  onDeviceClick: (device: DeviceSummary) => void;
}

const GRID_SIZE = 9;

export function VideoGrid({ devices, onDeviceClick }: Props) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(devices.length / GRID_SIZE));
  const pageDevices = devices.slice(page * GRID_SIZE, (page + 1) * GRID_SIZE);

  return (
    <div className="video-grid-container">
      <div className="video-grid">
        {Array.from({ length: GRID_SIZE }).map((_, i) => (
          <div key={i} className="grid-cell">
            {pageDevices[i] ? (
              <DeviceCard
                device={pageDevices[i]}
                index={page * GRID_SIZE + i}
                onClick={onDeviceClick}
              />
            ) : (
              <div className="empty-cell" />
            )}
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>이전</button>
          <span>{page + 1} / {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>다음</button>
        </div>
      )}
    </div>
  );
}
