import { useEffect, useRef, memo } from 'react';

interface Props {
  relayUrl: string;
  broadcastPath: string;
  deviceId: string;
  className?: string;
}

function randomId(len = 6): string {
  return Math.random().toString(36).slice(2, 2 + len).padEnd(len, '0');
}

function getBufferedRanges(buf: TimeRanges): string {
  const ranges: string[] = [];
  for (let i = 0; i < buf.length; i++) {
    ranges.push(`[${buf.start(i).toFixed(3)},${buf.end(i).toFixed(3)}]`);
  }
  return ranges.join(',') || 'none';
}

function videoSnapshot(video: HTMLVideoElement) {
  return {
    readyState: video.readyState,
    networkState: video.networkState,
    paused: video.paused,
    ended: video.ended,
    currentTime: video.currentTime,
    buffered: getBufferedRanges(video.buffered),
    seekable: getBufferedRanges(video.seekable),
    errorCode: video.error?.code ?? null,
  };
}

export const MoqVideo = memo(function MoqVideo({ relayUrl, broadcastPath, deviceId, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const moqWatchRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const instanceId = randomId();
    const t0 = performance.now();
    const log = (step: string, extra?: unknown) => {
      const elapsed = (performance.now() - t0).toFixed(1);
      if (extra !== undefined) {
        console.log(`[MoqVideo:${instanceId}] +${elapsed}ms ${step}`, extra);
      } else {
        console.log(`[MoqVideo:${instanceId}] +${elapsed}ms ${step}`);
      }
    };

    log('mount', { relayUrl, broadcastPath, deviceId });

    const disposers: Array<() => void> = [];

    const container = containerRef.current;
    if (!container) return;

    if (moqWatchRef.current) {
      moqWatchRef.current.remove();
      moqWatchRef.current = null;
    }

    const moqWatch = document.createElement('moq-watch');
    moqWatch.setAttribute('url', relayUrl);
    moqWatch.setAttribute('name', broadcastPath);
    moqWatch.setAttribute('jitter', '80');
    moqWatch.setAttribute('muted', '');
    moqWatch.setAttribute('volume', '0');

    const video = document.createElement('video');
    video.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000;display:block;';
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.controls = false;
    video.setAttribute('data-device-id', deviceId || broadcastPath.split('/')[0]);

    moqWatch.appendChild(video);
    container.appendChild(moqWatch);
    moqWatchRef.current = moqWatch;

    log('dom.appended', { jitter: 80 });

    // Signal subscriptions (moq-watch custom element — use `as any`)
    const mw = moqWatch as any;

    // connection.status
    try {
      const connStatus = mw?.connection?.status;
      if (connStatus && typeof connStatus.subscribe === 'function') {
        const unsub = connStatus.subscribe((status: unknown) => {
          log('signal.connection.status', { status });
        });
        if (typeof unsub === 'function') disposers.push(unsub);
      }
    } catch (_) { /* signal not available */ }

    // connection.established
    try {
      const connEstablished = mw?.connection?.established;
      if (connEstablished && typeof connEstablished.subscribe === 'function') {
        const unsub = connEstablished.subscribe((info: unknown) => {
          log('signal.connection.established', info);
        });
        if (typeof unsub === 'function') disposers.push(unsub);
      }
    } catch (_) { /* signal not available */ }

    // broadcast.status
    try {
      const broadcastStatus = mw?.broadcast?.status;
      if (broadcastStatus && typeof broadcastStatus.subscribe === 'function') {
        const unsub = broadcastStatus.subscribe((status: unknown) => {
          log('signal.broadcast.status', { status });
        });
        if (typeof unsub === 'function') disposers.push(unsub);
      }
    } catch (_) { /* signal not available */ }

    // backend.video.source.config
    try {
      const videoConfig = mw?.backend?.video?.source?.config;
      if (videoConfig && typeof videoConfig.subscribe === 'function') {
        const unsub = videoConfig.subscribe((config: any) => {
          log('signal.backend.video.source.config', {
            codec: config?.codec,
            container: config?.container,
            kind: config?.kind,
            timescale: config?.timescale,
            width: config?.codedWidth ?? config?.width,
            height: config?.codedHeight ?? config?.height,
          });
        });
        if (typeof unsub === 'function') disposers.push(unsub);
      }
    } catch (_) { /* signal not available */ }

    // backend.video.stalled
    try {
      const videoStalled = mw?.backend?.video?.stalled;
      if (videoStalled && typeof videoStalled.subscribe === 'function') {
        const unsub = videoStalled.subscribe((stalled: unknown) => {
          log('signal.backend.video.stalled', { stalled });
        });
        if (typeof unsub === 'function') disposers.push(unsub);
      }
    } catch (_) { /* signal not available */ }

    // backend.video.buffered (deduplicated)
    try {
      const videoBuffered = mw?.backend?.video?.buffered;
      if (videoBuffered && typeof videoBuffered.subscribe === 'function') {
        let lastBufferedLog = '';
        const unsub = videoBuffered.subscribe((buffered: unknown) => {
          const key = JSON.stringify(buffered);
          if (key !== lastBufferedLog) {
            lastBufferedLog = key;
            log('signal.backend.video.buffered', buffered);
          }
        });
        if (typeof unsub === 'function') disposers.push(unsub);
      }
    } catch (_) { /* signal not available */ }

    // backend.video.timestamp (first only)
    try {
      const videoTimestamp = mw?.backend?.video?.timestamp;
      if (videoTimestamp && typeof videoTimestamp.subscribe === 'function') {
        let firstTs = true;
        const unsub = videoTimestamp.subscribe((ts: unknown) => {
          if (firstTs) {
            firstTs = false;
            log('signal.backend.video.timestamp.first', { timestamp: ts });
          }
        });
        if (typeof unsub === 'function') disposers.push(unsub);
      }
    } catch (_) { /* signal not available */ }

    // Video media events
    let startupComplete = false;
    const VIDEO_EVENTS = [
      'loadstart', 'loadedmetadata', 'loadeddata', 'canplay',
      'play', 'playing', 'pause', 'waiting', 'stalled',
      'seeking', 'seeked', 'emptied', 'ended', 'error',
    ] as const;

    const handleVideoEvent = (e: Event) => {
      const snap = videoSnapshot(video);
      if (e.type === 'playing' && !startupComplete) {
        startupComplete = true;
        log('startup.complete', snap);
      } else {
        log(`video.event.${e.type}`, snap);
      }
    };

    for (const evName of VIDEO_EVENTS) {
      video.addEventListener(evName, handleVideoEvent);
      disposers.push(() => video.removeEventListener(evName, handleVideoEvent));
    }

    // 500ms polling (deduplicated by JSON key)
    let lastPollKey = '';
    const pollInterval = setInterval(() => {
      const snap = videoSnapshot(video);
      const key = JSON.stringify({
        readyState: snap.readyState,
        networkState: snap.networkState,
        paused: snap.paused,
        buffered: snap.buffered,
      });
      if (key !== lastPollKey) {
        lastPollKey = key;
        log('poll.video.state', snap);
      }
    }, 500);
    disposers.push(() => clearInterval(pollInterval));

    const tryPlay = () => {
      video.play().catch(() => {});
      document.removeEventListener('click', tryPlay);
    };
    document.addEventListener('click', tryPlay);
    disposers.push(() => document.removeEventListener('click', tryPlay));

    return () => {
      log('cleanup.start');
      for (const dispose of disposers) {
        try { dispose(); } catch (_) { /* ignore */ }
      }
      if (moqWatchRef.current) {
        moqWatchRef.current.remove();
        moqWatchRef.current = null;
      }
      log('cleanup.done');
    };
  }, [relayUrl, broadcastPath, deviceId]);

  return <div ref={containerRef} className={className} />;
});
