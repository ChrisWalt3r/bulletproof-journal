import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { IoArrowBack, IoChevronBack, IoChevronForward, IoOpenOutline } from 'react-icons/io5';

export default function ImageViewerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { entryId } = useParams();
  const [searchParams] = useSearchParams();

  const stateImages = Array.isArray(location.state?.images)
    ? location.state.images.filter((item) => item?.src)
    : [];
  const querySrc = searchParams.get('src') || '';
  const queryTitle = searchParams.get('title') || 'Trade image';

  const images = useMemo(() => {
    if (stateImages.length > 0) {
      return stateImages;
    }

    return querySrc
      ? [
          {
            id: Number(entryId) || entryId,
            src: querySrc,
            title: queryTitle,
          },
        ]
      : [];
  }, [entryId, querySrc, queryTitle, stateImages]);

  const initialIndex = useMemo(() => {
    if (!images.length) {
      return 0;
    }

    const requestedIndex = Number(location.state?.initialIndex);
    if (Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < images.length) {
      return requestedIndex;
    }

    return 0;
  }, [images.length, location.state?.initialIndex]);

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const activeImage = images[activeIndex] || null;
  const canOpenEntry = Boolean(location.state?.canOpenEntry);
  const fromPath = location.state?.from || '/journal';

  const goBack = () => {
    navigate(fromPath);
  };

  if (!activeImage) {
    return (
      <main className="image-viewer-page">
        <header className="image-viewer-page__topbar">
          <button type="button" className="ghost-button" onClick={goBack}>
            <IoArrowBack size={18} />
            Back
          </button>
        </header>
        <section className="image-viewer-page__empty">
          <h1>Image unavailable</h1>
          <p>This image could not be loaded. Return to the previous page and try again.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="image-viewer-page">
      <header className="image-viewer-page__topbar">
        <div className="button-row">
          <button type="button" className="ghost-button" onClick={goBack}>
            <IoArrowBack size={18} />
            Back
          </button>
          {images.length > 1 ? (
            <span className="image-viewer-page__counter">
              {activeIndex + 1} / {images.length}
            </span>
          ) : null}
        </div>

        <div className="button-row">
          {canOpenEntry ? (
            <button
              type="button"
              className="primary-button"
              onClick={() => navigate(`/journal/${activeImage.id}`)}
            >
              <IoOpenOutline size={18} />
              Open Trade Entry
            </button>
          ) : null}
        </div>
      </header>

      <section className="image-viewer-page__canvas">
        {images.length > 1 ? (
          <button
            type="button"
            className="icon-button image-viewer-page__nav image-viewer-page__nav--left"
            onClick={() => setActiveIndex((value) => Math.max(value - 1, 0))}
            disabled={activeIndex === 0}
            aria-label="Previous image"
          >
            <IoChevronBack size={22} />
          </button>
        ) : null}

        <figure className="image-viewer-page__figure">
          <img src={activeImage.src} alt={activeImage.title || 'Trade image'} />
          <figcaption>
            <strong>{activeImage.title || 'Trade image'}</strong>
            {activeImage.subtitle ? <span>{activeImage.subtitle}</span> : null}
            {activeImage.dateTime ? <span>{activeImage.dateTime}</span> : null}
          </figcaption>
        </figure>

        {images.length > 1 ? (
          <button
            type="button"
            className="icon-button image-viewer-page__nav image-viewer-page__nav--right"
            onClick={() =>
              setActiveIndex((value) => Math.min(value + 1, images.length - 1))
            }
            disabled={activeIndex === images.length - 1}
            aria-label="Next image"
          >
            <IoChevronForward size={22} />
          </button>
        ) : null}
      </section>

      {images.length > 1 ? (
        <section className="image-viewer-page__thumbs" aria-label="Image strip">
          {images.map((image, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={`${image.id}-${index}`}
                type="button"
                className={`image-viewer-page__thumb ${isActive ? 'is-active' : ''}`}
                onClick={() => setActiveIndex(index)}
              >
                <img src={image.src} alt={image.title || `Trade image ${index + 1}`} />
              </button>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}
