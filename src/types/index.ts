export interface DeviceSummary {
  deviceId: string;
  cameraId: string;
  streamId: string;
  displayName: string;
  width: number;
  height: number;
  fps: number;
  encodingProfile: string;
  battery: number | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  missionId: string | null;
  missionStatus: string | null;
  publisherTxBps: number | null;
  connectedAt: string;
  lastSeenAt: string;
  relayUrl: string;
  broadcastPath: string;
}

export interface WsMessage<T = unknown> {
  type: 'snapshot' | 'device_upsert' | 'device_remove';
  payload: T;
  timestamp: string;
}

export interface SnapshotPayload {
  devices: DeviceSummary[];
}

export interface DeviceUpsertPayload {
  device: DeviceSummary;
}

export interface DeviceRemovePayload {
  deviceId: string;
  reason: string;
}
