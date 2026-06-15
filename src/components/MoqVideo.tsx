import { useEffect, useRef, memo } from 'react';

const DEBUG = import.meta.env.DEV;

// Watchdog tuning. The publisher hard-reconnect path bumps streamRevision and
// remounts via the parent key; the watchdog is the safety net for stalls that
// happen *without* a revision bump (the <moq-watch> subscription freezes on the
// last frame and never resumes on its own).
const WATCHDOG_POLL_MS = 1000;        // how often we sample playback progress
const STALL_THRESHOLD_MS = 4000;      // no progress for this long → stalled (3–5s)
const STARTUP_GRACE_MS = 3000;        // grace after a (re)mount before we can fire
const BACKOFF_STEPS_MS = [1000, 2000, 5000]; // remount backoff, then hold at last

interface Props {
  relayUrl: string;
  broadcastPath: string;
  deviceId: string;
  streamRevision?: number;
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

export const MoqVideo = memo(function MoqVideo({ relayUrl, broadcastPath, deviceId, streamRevision, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const moqWatchRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const instanceId = randomId();
    const t0 = performance.now();
    const log = DEBUG ? (step: string, extra?: unknown) => {
      const elapsed = (performance.now() - t0).toFixed(1);
      if (extra !== undefined) {
        console.log(`[MoqVideo:${instanceId}] +${elapsed}ms ${step}`, extra);
      } else {
        console.log(`[MoqVideo:${instanceId}] +${elapsed}ms ${step}`);
      }
    } : () => {};

    log('mount', { relayUrl, broadcastPath, deviceId, streamRevision });

    const container = containerRef.current;
    if (!container) return;

    // Disposers for the *current* <moq-watch> generation. A watchdog remount
    // tears these down and rebuilds, so they must be re-collected per generation
    // (kept separate from watchdog-level timers below).
    let genDisposers: Array<() => void> = [];

    // ---- Watchdog state (spans generations) -------------------------------
    let currentVideo: HTMLVideoElement | null = null;
    let lastProgressTs = 0;          // performance.now() of last observed advance
    let lastVideoCurrentTime = -1;   // <video>.currentTime at last sample
    let lastBackendTs: number | null = null; // backend.video.timestamp at last sample
    let generationStart = 0;         // performance.now() when current gen mounted
    let remountCount = 0;            // # of watchdog remounts → backoff index
    let watchdogPoll: ReturnType<typeof setInterval> | null = null;
    let pendingRemount: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;            // effect cleanup ran → stop everything

    const noteProgress = () => { lastProgressTs = performance.now(); };

    // Builds a fresh <moq-watch> + <video> with the SAME relayUrl/broadcastPath.
    // Used for both the initial mount and every watchdog remount.
    const createWatch = () => {
      genDisposers = [];

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
      currentVideo = video;

      log('dom.appended', { jitter: 80 });

      // Reset progress baseline + startup grace for this generation.
      generationStart = performance.now();
      lastProgressTs = generationStart;
      lastVideoCurrentTime = -1;
      lastBackendTs = null;

      const mw = moqWatch as any;

      // Backend timestamp drives stall detection in both DEBUG and prod: any
      // advance counts as progress. (Subscribed unconditionally for the
      // watchdog; DEBUG adds its own first-timestamp log below.)
      try {
        const tsSignal = mw?.backend?.video?.timestamp;
        if (tsSignal && typeof tsSignal.subscribe === 'function') {
          const unsub = tsSignal.subscribe((ts: number | null | undefined) => {
            if (typeof ts === 'number' && ts !== lastBackendTs) {
              lastBackendTs = ts;
              noteProgress();
            }
          });
          if (typeof unsub === 'function') genDisposers.push(unsub);
        }
      } catch { /* signal not available */ }

      if (DEBUG) {
        // Signal subscriptions (moq-watch custom element — use `as any`)
        const trySubscribe = (_path: string, getter: () => any, cb: (v: any) => void) => {
          try {
            const signal = getter();
            if (signal && typeof signal.subscribe === 'function') {
              const unsub = signal.subscribe(cb);
              if (typeof unsub === 'function') genDisposers.push(unsub);
            }
          } catch { /* signal not available */ }
        };

        trySubscribe('connection.status', () => mw?.connection?.status, (status) => {
          log('signal.connection.status', { status });
        });
        trySubscribe('connection.established', () => mw?.connection?.established, (info) => {
          log('signal.connection.established', info);
        });
        trySubscribe('broadcast.status', () => mw?.broadcast?.status, (status) => {
          log('signal.broadcast.status', { status });
        });
        trySubscribe('backend.video.source.config', () => mw?.backend?.video?.source?.config, (config) => {
          log('signal.backend.video.source.config', {
            codec: config?.codec, container: config?.container,
            width: config?.codedWidth ?? config?.width,
            height: config?.codedHeight ?? config?.height,
          });
        });
        trySubscribe('backend.video.stalled', () => mw?.backend?.video?.stalled, (stalled) => {
          log('signal.backend.video.stalled', { stalled });
        });

        let lastBufferedLog = '';
        trySubscribe('backend.video.buffered', () => mw?.backend?.video?.buffered, (buffered) => {
          const key = JSON.stringify(buffered);
          if (key !== lastBufferedLog) { lastBufferedLog = key; log('signal.backend.video.buffered', buffered); }
        });

        let firstTs = true;
        trySubscribe('backend.video.timestamp', () => mw?.backend?.video?.timestamp, (ts) => {
          if (firstTs) { firstTs = false; log('signal.backend.video.timestamp.first', { timestamp: ts }); }
        });
      }

      // Video media events: feed the watchdog (waiting/stalled/error/ended) and,
      // in DEBUG, log every transition as before.
      let startupComplete = false;
      const VIDEO_EVENTS = [
        'loadstart', 'loadedmetadata', 'loadeddata', 'canplay',
        'play', 'playing', 'pause', 'waiting', 'stalled',
        'seeking', 'seeked', 'emptied', 'ended', 'error',
      ] as const;

      const handleVideoEvent = (e: Event) => {
        // 'playing' means frames are flowing → fresh progress baseline.
        if (e.type === 'playing') noteProgress();
        if (DEBUG) {
          const snap = videoSnapshot(video);
          if (e.type === 'playing' && !startupComplete) {
            startupComplete = true;
            log('startup.complete', snap);
          } else {
            log(`video.event.${e.type}`, snap);
          }
        }
      };

      for (const evName of VIDEO_EVENTS) {
        video.addEventListener(evName, handleVideoEvent);
        genDisposers.push(() => video.removeEventListener(evName, handleVideoEvent));
      }

      if (DEBUG) {
        // 500ms polling (deduplicated by JSON key)
        let lastPollKey = '';
        const pollInterval = setInterval(() => {
          const snap = videoSnapshot(video);
          const key = JSON.stringify({ readyState: snap.readyState, networkState: snap.networkState, paused: snap.paused, buffered: snap.buffered });
          if (key !== lastPollKey) { lastPollKey = key; log('poll.video.state', snap); }
        }, 500);
        genDisposers.push(() => clearInterval(pollInterval));
      }

      const tryPlay = () => {
        video.play().catch(() => {});
        document.removeEventListener('click', tryPlay);
      };
      document.addEventListener('click', tryPlay);
      genDisposers.push(() => document.removeEventListener('click', tryPlay));
    };

    const disposeGeneration = () => {
      for (const dispose of genDisposers) {
        try { dispose(); } catch { /* ignore */ }
      }
      genDisposers = [];
    };

    // Recreate the <moq-watch> in place (same relayUrl/broadcastPath) after a
    // backoff. Same recreation path as the streamRevision-driven remount.
    const scheduleRemount = (reason: string) => {
      if (disposed || pendingRemount) return;
      const delay = BACKOFF_STEPS_MS[Math.min(remountCount, BACKOFF_STEPS_MS.length - 1)];
      remountCount++;
      log(`MoqVideo watchdog remount reason=${reason}`, {
        deviceId, broadcastPath, streamRevision, attempt: remountCount, delayMs: delay,
      });
      pendingRemount = setTimeout(() => {
        pendingRemount = null;
        if (disposed) return;
        disposeGeneration();
        createWatch();
      }, delay);
    };

    const checkWatchdog = () => {
      if (disposed || pendingRemount || !currentVideo) return;
      const now = performance.now();

      // Startup grace: give the (re)mount time to establish before judging it.
      if (now - generationStart < STARTUP_GRACE_MS) return;

      // <video>.currentTime advancing also counts as progress.
      const ct = currentVideo.currentTime;
      if (ct > lastVideoCurrentTime + 0.01) {
        lastVideoCurrentTime = ct;
        noteProgress();
      }

      const stalledFor = now - lastProgressTs;
      if (stalledFor >= STALL_THRESHOLD_MS) {
        const reason = currentVideo.error
          ? `video-error-${currentVideo.error.code}`
          : currentVideo.ended
            ? 'ended'
            : 'no-progress';
        scheduleRemount(reason);
      }
    };

    // Initial mount.
    createWatch();

    watchdogPoll = setInterval(checkWatchdog, WATCHDOG_POLL_MS);

    return () => {
      disposed = true;
      log('cleanup.start');
      if (watchdogPoll) { clearInterval(watchdogPoll); watchdogPoll = null; }
      if (pendingRemount) { clearTimeout(pendingRemount); pendingRemount = null; }
      disposeGeneration();
      if (moqWatchRef.current) {
        moqWatchRef.current.remove();
        moqWatchRef.current = null;
      }
      currentVideo = null;
      log('cleanup.done');
    };
  }, [relayUrl, broadcastPath, deviceId, streamRevision]);

  return <div ref={containerRef} className={className} />;
});
