import { useEffect, useRef } from 'react';

interface Props {
  relayUrl: string;
  broadcastPath: string;
  className?: string;
}

export function MoqVideo({ relayUrl, broadcastPath, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const moqWatch = document.createElement('moq-watch');
    moqWatch.setAttribute('url', relayUrl);
    moqWatch.setAttribute('name', broadcastPath);

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.objectFit = 'contain';
    canvas.style.backgroundColor = '#000';

    moqWatch.appendChild(canvas);
    container.appendChild(moqWatch);

    console.log('[MoqVideo] url=', relayUrl, 'path=', broadcastPath);

    return () => {
      container.innerHTML = '';
    };
  }, [relayUrl, broadcastPath]);

  return <div ref={containerRef} className={className} />;
}
