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
    moqWatch.style.cssText = 'width:100%;height:100%;display:block;position:relative;overflow:hidden;';

    const video = document.createElement('video');
    video.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000;display:block;';
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.controls = false;

    moqWatch.appendChild(video);
    container.appendChild(moqWatch);
    moqWatchRef.current = moqWatch;

    // @moq/watch 내장 UI 요소 숨기기 (동적 생성되는 것 포함)
    const observer = new MutationObserver(() => {
      moqWatch.querySelectorAll(':not(video):not(style)').forEach(el => {
        if (el !== video && el.tagName !== 'STYLE' && el.tagName !== 'SOURCE') {
          (el as HTMLElement).style.display = 'none';
        }
      });
    });
    observer.observe(moqWatch, { childList: true, subtree: true });

    const tryPlay = () => {
      video.play().catch(() => {});
      document.removeEventListener('click', tryPlay);
    };
    document.addEventListener('click', tryPlay);

    console.log('[MoqVideo] url=', relayUrl, 'path=', broadcastPath);

    return () => {
      observer.disconnect();
      document.removeEventListener('click', tryPlay);
      if (moqWatchRef.current) {
        moqWatchRef.current.remove();
        moqWatchRef.current = null;
      }
    };
  }, [relayUrl, broadcastPath]);

  return <div ref={containerRef} className={className} />;
});
