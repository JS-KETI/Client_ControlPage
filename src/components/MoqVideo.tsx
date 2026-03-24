import { useEffect, useRef, memo } from 'react';

interface Props {
  relayUrl: string;
  broadcastPath: string;
  className?: string;
}

export const MoqVideo = memo(function MoqVideo({ relayUrl, broadcastPath, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const moqWatchRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 이미 생성된 moq-watch가 있으면 제거
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
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'contain';
    video.style.backgroundColor = '#000';
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;

    moqWatch.appendChild(video);
    container.appendChild(moqWatch);
    moqWatchRef.current = moqWatch;

    // 자동재생 정책 우회: 사용자 상호작용 후 play 재시도
    const tryPlay = () => {
      video.play().catch(() => {});
      document.removeEventListener('click', tryPlay);
    };
    document.addEventListener('click', tryPlay);

    console.log('[MoqVideo] url=', relayUrl, 'path=', broadcastPath);

    return () => {
      if (moqWatchRef.current) {
        moqWatchRef.current.remove();
        moqWatchRef.current = null;
      }
    };
  }, [relayUrl, broadcastPath]);

  return <div ref={containerRef} className={className} />;
});
