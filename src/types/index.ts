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
  // Bumped by the server only when the publisher hard-reconnects. Missing on
  // older data → treat as 0. On increment the control page rebuilds the player
  // so it doesn't stay frozen on the last frame.
  streamRevision?: number;
  // Bumped on a session-preserving QUIC path rebind success (Wi-Fi↔Cellular).
  // Distinct from streamRevision (hard reconnect). The control page remounts the
  // player when EITHER revision changes, so a seamless rebind recovers instantly
  // instead of waiting for the stall watchdog (~13s). Missing → treat as 0.
  migrationRevision?: number;
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
