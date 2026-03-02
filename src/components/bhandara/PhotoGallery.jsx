import { useState } from 'react';

export default function PhotoGallery({ photos = [] }) {
  const [current, setCurrent] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  if (!photos.length) return null;

  function next() { setCurrent(c => (c + 1) % photos.length); }
  function prev() { setCurrent(c => (c - 1 + photos.length) % photos.length); }

  return (
    <>
      <div className="gallery">
        <div className="gallery-main" onClick={() => setFullscreen(true)}>
          <img src={photos[current]} alt={`Photo ${current + 1}`} className="gallery-img" />
          {photos.length > 1 && (
            <>
              <button className="gallery-prev" onClick={e => { e.stopPropagation(); prev(); }}>‹</button>
              <button className="gallery-next" onClick={e => { e.stopPropagation(); next(); }}>›</button>
            </>
          )}
          <div className="gallery-dots">
            {photos.map((_, i) => (
              <span key={i} className={`dot ${i === current ? 'dot-active' : ''}`} onClick={e => { e.stopPropagation(); setCurrent(i); }} />
            ))}
          </div>
        </div>
      </div>

      {fullscreen && (
        <div className="fullscreen-overlay" onClick={() => setFullscreen(false)}>
          <img src={photos[current]} alt="" className="fullscreen-img" />
          {photos.length > 1 && (
            <>
              <button className="fs-prev" onClick={e => { e.stopPropagation(); prev(); }}>‹</button>
              <button className="fs-next" onClick={e => { e.stopPropagation(); next(); }}>›</button>
            </>
          )}
          <button className="fs-close" onClick={() => setFullscreen(false)}>✕</button>
        </div>
      )}
    </>
  );
}
