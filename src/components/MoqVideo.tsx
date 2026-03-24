import { useEffect, useRef, memo } from 'react';

interface Props {
  relayUrl: string;
  broadcastPath: string;
  deviceId: string;
  className?: string;
}

export const MoqVideo = memo(function MoqVideo({ relayUrl, broadcastPath, deviceId, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const moqWatchRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (moqWatchRef.current) {
      moqWatchRef.current.remove();
      moqWatchRef.current = null;
    }

    const moqWatch = document.createElement('moq-watch');
    moqWatch.setAttribute('url', relayUrl);
    moqWatch.setAttribute('name', broadcastPath);
    moqWatch.setAttribute('jitter', '150');
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

    const tryPlay = () => {
      video.play().catch(() => {});
      document.removeEventListener('click', tryPlay);
    };
    document.addEventListener('click', tryPlay);

    console.log('[MoqVideo] url=', relayUrl, 'path=', broadcastPath);

    return () => {
      document.removeEventListener('click', tryPlay);
      if (moqWatchRef.current) {
        moqWatchRef.current.remove();
        moqWatchRef.current = null;
      }
    };
  }, [relayUrl, broadcastPath]);

  return <div ref={containerRef} className={className} />;
});
