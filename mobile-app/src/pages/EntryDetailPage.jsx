import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  IoArrowBack,
  IoCameraOutline,
  IoCheckmarkCircle,
  IoCloudUploadOutline,
  IoCreateOutline,
  IoDocumentTextOutline,
  IoImagesOutline,
  IoShieldCheckmarkOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import PageHeader from '../components/PageHeader.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useAccount } from '../context/AccountContext.jsx';
import { imageAPI, journalAPI } from '../services/api.js';
import { formatKampalaDate, formatKampalaTime } from '../utils/dateUtils.js';
import { getEntryTradeDate } from '../utils/tradeDates.js';
import {
  buildManualEntryContent,
  formatPnlPercentage,
  getEntryOutcome,
  getEntryPair,
  getPnlValue,
  getPnlPercentageValue,
  getPlanStatusLabel,
  getResultColor,
  getRiskRewardValue,
  normalizeGalleryImages,
  parseManualEntryContent,
  PAIRS,
  TRADE_DIRECTIONS,
  TRADE_RESULTS,
} from '../utils/tradeUtils.js';

const createLocalAsset = (file) => ({
  id: `${file.name}-${file.lastModified}-${Math.random().toString(16).slice(2)}`,
  file,
  url: URL.createObjectURL(file),
});

const createExistingAsset = (url) => ({
  id: url,
  file: null,
  url,
});

const revokeAsset = (asset) => {
  if (asset?.file && asset.url?.startsWith('blob:')) {
    URL.revokeObjectURL(asset.url);
  }
};

const formatForDateTimeInput = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return '';
  }

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
};

export default function EntryDetailPage() {
  const navigate = useNavigate();
  const { entryId } = useParams();
  const { currentAccount } = useAccount();
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [selectedPair, setSelectedPair] = useState('');
  const [tradeDirection, setTradeDirection] = useState('');
  const [tradeResult, setTradeResult] = useState('');
  const [riskReward, setRiskReward] = useState('');
  const [pnl, setPnl] = useState('');
  const [pnlPercentage, setPnlPercentage] = useState('');
  const [tradeDateTime, setTradeDateTime] = useState('');
  const [notes, setNotes] = useState('');
  const [isFollowingPlan, setIsFollowingPlan] = useState(false);
  const [emotionalState, setEmotionalState] = useState('');
  const [setupAsset, setSetupAsset] = useState(null);
  const [executionAsset, setExecutionAsset] = useState(null);
  const [galleryItems, setGalleryItems] = useState([]);

  const setupInputRef = useRef(null);
  const setupCameraRef = useRef(null);
  const executionInputRef = useRef(null);
  const executionCameraRef = useRef(null);
  const galleryInputRef = useRef(null);
  const galleryCameraRef = useRef(null);

  useEffect(() => () => revokeAsset(setupAsset), [setupAsset]);
  useEffect(() => () => revokeAsset(executionAsset), [executionAsset]);
  useEffect(
    () => () => {
      galleryItems.forEach(revokeAsset);
    },
    [galleryItems]
  );

  useEffect(() => {
    const loadEntry = async () => {
      setLoading(true);
      try {
        const response = await journalAPI.getEntry(entryId);
        const nextEntry = response.entry || response;
        setEntry(nextEntry);
        hydrateForm(nextEntry);
      } catch (error) {
        console.error('Failed to load entry detail', error);
        window.alert('Failed to load the selected entry.');
      } finally {
        setLoading(false);
      }
    };

    loadEntry();
  }, [entryId]);

  function hydrateForm(nextEntry) {
    const parsedContent = parseManualEntryContent(nextEntry?.content || '');
    const inferredResult =
      nextEntry?.mt5_ticket && nextEntry?.pnl != null
        ? getEntryOutcome(nextEntry)
        : parsedContent.tradeResult;

    setSelectedPair(nextEntry?.symbol || parsedContent.selectedPair || '');
    setTradeDirection(nextEntry?.direction || parsedContent.tradeDirection || '');
    setTradeResult(inferredResult || '');
    setRiskReward(getRiskRewardValue(nextEntry) || '');
    setPnl(
      Number.isFinite(getPnlValue(nextEntry))
        ? String(getPnlValue(nextEntry))
        : parsedContent.pnl || ''
    );
    setPnlPercentage(
      Number.isFinite(getPnlPercentageValue(nextEntry))
        ? String(getPnlPercentageValue(nextEntry))
        : parsedContent.pnlPercentage || ''
    );
    setTradeDateTime(
      formatForDateTimeInput(getEntryTradeDate(nextEntry)?.toISOString() || nextEntry?.created_at)
    );
    setNotes(nextEntry?.notes || parsedContent.notes || '');
    setIsFollowingPlan(
      nextEntry?.following_plan === true || nextEntry?.following_plan === 'true'
    );
    setEmotionalState(nextEntry?.emotional_state || parsedContent.emotionalState || '');
    setSetupAsset(
      nextEntry?.before_image_url || nextEntry?.image_url
        ? createExistingAsset(nextEntry.before_image_url || nextEntry.image_url)
        : null
    );
    setExecutionAsset(
      nextEntry?.execution_tf_image_url
        ? createExistingAsset(nextEntry.execution_tf_image_url)
        : null
    );
    setGalleryItems(
      normalizeGalleryImages(nextEntry?.gallery_images).map((url) =>
        createExistingAsset(url)
      )
    );
  }

  const detailCards = useMemo(
    () => [
      { label: 'Pair', value: selectedPair || getEntryPair(entry) },
      {
        label: 'Trade Date & Time',
        value: `${formatKampalaDate(getEntryTradeDate(entry) || entry?.created_at)} ${formatKampalaTime(
          getEntryTradeDate(entry) || entry?.created_at
        )}`,
      },
      { label: 'Direction', value: tradeDirection || entry?.direction || 'N/A' },
      { label: 'Outcome', value: tradeResult || getEntryOutcome(entry) },
      { label: 'Risk : Reward', value: riskReward || 'N/A' },
      {
        label: 'P&L',
        value: (() => {
          const pnlValue = getPnlValue(entry);
          return Number.isFinite(pnlValue)
            ? `${pnlValue >= 0 ? '+' : ''}$${Math.abs(pnlValue).toFixed(2)}`
            : 'N/A';
        })(),
      },
      {
        label: 'P&L %',
        value: formatPnlPercentage(entry),
      },
      {
        label: 'Plan Status',
        value: getPlanStatusLabel(
          entry?.following_plan === true || entry?.following_plan === 'true'
            ? 'FOLLOWED'
            : entry?.following_plan === false || entry?.following_plan === 'false'
              ? 'NOT_FOLLOWED'
              : 'NOT_RECORDED'
        ),
      },
    ],
    [entry, riskReward, selectedPair, tradeDirection, tradeResult]
  );

  const handleSingleAsset = (setter, currentAsset, file) => {
    if (!file) {
      return;
    }

    revokeAsset(currentAsset);
    setter(createLocalAsset(file));
  };

  const handleGalleryFiles = (fileList) => {
    const nextFiles = Array.from(fileList || []).slice(0, 5 - galleryItems.length);
    if (!nextFiles.length) {
      return;
    }

    setGalleryItems((current) => [
      ...current,
      ...nextFiles.map((file) => createLocalAsset(file)),
    ]);
  };

  const handleDeleteEntry = async () => {
    if (!entry || !window.confirm('Delete this trade entry?')) {
      return;
    }

    try {
      await journalAPI.deleteEntry(entry.id);
      navigate('/journal');
    } catch (error) {
      console.error('Failed to delete entry', error);
      window.alert('Failed to delete the entry.');
    }
  };

  const handleSave = async () => {
    if (!entry || isSaving) {
      return;
    }

    if (!entry.mt5_ticket) {
      if (!selectedPair || !tradeDirection || !tradeResult) {
        window.alert('Pair, direction, and result are required for manual entries.');
        return;
      }

      if (!riskReward?.trim()) {
        window.alert('Risk : Reward is required for manual entries.');
        return;
      }

      const parsedPnl = Number(pnl);
      if (!Number.isFinite(parsedPnl)) {
        window.alert('Please provide a valid P&L value.');
        return;
      }

      const parsedPnlPercentage = Number(pnlPercentage);
      if (!Number.isFinite(parsedPnlPercentage)) {
        window.alert('Please provide a valid P&L % value.');
        return;
      }

      if (!tradeDateTime.trim() || Number.isNaN(new Date(tradeDateTime).getTime())) {
        window.alert('Trade date and time are required for manual entries.');
        return;
      }
    }

    setIsSaving(true);

    try {
      let imageUrl = entry.image_url || entry.before_image_url || null;
      let imageFilename = entry.image_filename || null;
      let executionTfImageUrl = entry.execution_tf_image_url || null;
      let executionTfImageFilename = entry.execution_tf_image_filename || null;
      const clearImage = !setupAsset && Boolean(entry.image_url || entry.before_image_url);
      const clearExecutionTfImage = !executionAsset && Boolean(entry.execution_tf_image_url);

      if (setupAsset?.file) {
        setIsUploading(true);
        const upload = await imageAPI.uploadImage(setupAsset.file);
        imageUrl = upload.imageUrl;
        imageFilename = upload.filename;
      } else if (setupAsset?.url) {
        imageUrl = setupAsset.url;
      } else {
        imageUrl = clearImage ? '' : null;
        imageFilename = clearImage ? '' : null;
      }

      if (executionAsset?.file) {
        setIsUploading(true);
        const upload = await imageAPI.uploadImage(executionAsset.file);
        executionTfImageUrl = upload.imageUrl;
        executionTfImageFilename = upload.filename;
      } else if (executionAsset?.url) {
        executionTfImageUrl = executionAsset.url;
      } else {
        executionTfImageUrl = clearExecutionTfImage ? '' : null;
        executionTfImageFilename = clearExecutionTfImage ? '' : null;
      }

      const uploadedGallery = [];
      for (const item of galleryItems) {
        if (item.file) {
          setIsUploading(true);
          const upload = await imageAPI.uploadImage(item.file);
          uploadedGallery.push(upload.imageUrl);
        } else if (item.url) {
          uploadedGallery.push(item.url);
        }
      }

      const response = await journalAPI.updateEntry(entry.id, {
        content: entry.mt5_ticket
          ? entry.content
          : buildManualEntryContent({
              selectedPair,
              tradeDirection,
              tradeResult,
              riskReward,
              pnl,
              pnlPercentage,
              tradeDateTime,
              emotionalState,
              notes,
              hasSetupImage: Boolean(setupAsset),
              hasExecutionImage: Boolean(executionAsset),
              additionalImageCount: uploadedGallery.length,
            }),
        imageUrl,
        imageFilename,
        executionTfImageUrl,
        executionTfImageFilename,
        accountId: currentAccount?.id || entry.account_id,
        symbol: selectedPair,
        direction: tradeDirection,
        pnl: !entry.mt5_ticket ? Number(pnl) : undefined,
        followingPlan: isFollowingPlan,
        emotionalState,
        notes,
        pnlPercentage: !entry.mt5_ticket ? Number(pnlPercentage) : getPnlPercentageValue(entry),
        galleryImages: uploadedGallery,
        createdAt: !entry.mt5_ticket ? new Date(tradeDateTime).toISOString() : undefined,
        clearImage,
        clearExecutionTfImage,
      });

      if (response.entry) {
        const refreshedResponse = await journalAPI.getEntry(entry.id);
        const refreshedEntry = refreshedResponse.entry || response.entry;

        if (clearImage && (entry.image_filename || entry.image_url)) {
          await imageAPI.deleteImage(entry.image_filename || entry.image_url);
        }
        if (
          clearExecutionTfImage &&
          (entry.execution_tf_image_filename || entry.execution_tf_image_url)
        ) {
          await imageAPI.deleteImage(
            entry.execution_tf_image_filename || entry.execution_tf_image_url
          );
        }

        setEntry(refreshedEntry);
        hydrateForm(refreshedEntry);
        setIsEditing(false);
      } else {
        window.alert(response.error || 'Failed to update entry.');
      }
    } catch (error) {
      console.error('Failed to save entry', error);
      window.alert('Failed to save entry changes.');
    } finally {
      setIsSaving(false);
      setIsUploading(false);
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading trade entry..." compact />;
  }

  if (!entry) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="Entry Detail"
          title="Entry not found"
          subtitle="The requested trade entry could not be loaded."
        />
        <EmptyState
          title="Missing entry"
          description="Go back to the journal and choose another trade."
        />
      </div>
    );
  }

  const outcome = tradeResult || getEntryOutcome(entry);
  const primaryImage = setupAsset?.url || '';
  const executionImage = executionAsset?.url || '';

  const openImagePreview = (src, title, imageKey) => {
    if (!src) {
      return;
    }

    navigate(
      `/image-viewer/${entry.id}/${imageKey}?src=${encodeURIComponent(
        src
      )}&title=${encodeURIComponent(title)}`,
      {
        state: {
          from: `/journal/${entry.id}`,
          images: [{ id: entry.id, src, title }],
          initialIndex: 0,
          canOpenEntry: false,
        },
      }
    );
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Entry Detail"
        title={getEntryPair(entry)}
        subtitle={`${formatKampalaDate(entry.created_at)} at ${formatKampalaTime(entry.created_at)}`}
        actions={
          <div className="button-row">
            <Link className="ghost-button" to="/journal">
              <IoArrowBack size={18} />
              Back
            </Link>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setIsEditing((value) => !value)}
            >
              <IoCreateOutline size={18} />
              {isEditing ? 'Cancel Edit' : 'Edit'}
            </button>
            <button type="button" className="ghost-button" onClick={handleDeleteEntry}>
              <IoTrashOutline size={18} />
              Delete
            </button>
          </div>
        }
      />

      <section className="dashboard-hero">
        <article className="hero-card" style={{ '--result-color': getResultColor(outcome) }}>
          <span>Outcome</span>
          <strong style={{ color: getResultColor(outcome) }}>{outcome}</strong>
          <p>{entry.mt5_ticket ? 'MT5 imported trade' : 'Manual journal entry'}</p>
        </article>
        <article className="hero-card">
          <span>Account</span>
          <strong>{currentAccount?.name || entry.account_id}</strong>
          <p>Current detail view and update target.</p>
        </article>
        <article className="hero-card">
          <span>Plan Status</span>
          <strong>{getPlanStatusLabel(isFollowingPlan ? 'FOLLOWED' : 'NOT_RECORDED')}</strong>
          <p>{isFollowingPlan ? 'Marked as following plan.' : 'Can be updated during review.'}</p>
        </article>
      </section>

      <section className="detail-grid">
        <article className="surface-card detail-card">
          <div className="section-heading">
            <div>
              <span className="section-heading__eyebrow">Primary Image</span>
              <h2>Primary image</h2>
            </div>
          </div>

          {primaryImage ? (
            <div className="image-preview-card">
              <button
                type="button"
                className="image-preview-trigger"
                onClick={() => openImagePreview(primaryImage, 'Primary image', 'setup')}
              >
                <img src={primaryImage} alt="Primary trade image" />
              </button>
            </div>
          ) : (
            <EmptyState
              title="No setup image"
              description="Upload one while editing so this entry has a primary trade image."
            />
          )}

          {isEditing ? (
            <>
              <div className="button-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setupInputRef.current?.click()}
                >
                  <IoCloudUploadOutline size={18} />
                  Browse
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setupCameraRef.current?.click()}
                >
                  <IoCameraOutline size={18} />
                  Camera
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setSetupAsset(null)}
                >
                  Remove
                </button>
              </div>
              <input
                ref={setupInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) =>
                  handleSingleAsset(setSetupAsset, setupAsset, event.target.files?.[0])
                }
              />
              <input
                ref={setupCameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(event) =>
                  handleSingleAsset(setSetupAsset, setupAsset, event.target.files?.[0])
                }
              />
            </>
          ) : null}
        </article>

        <article className="surface-card detail-card">
          <div className="section-heading">
            <div>
              <span className="section-heading__eyebrow">Trade Details</span>
              <h2>Core information</h2>
            </div>
          </div>

          {isEditing && !entry.mt5_ticket ? (
            <div className="stack-lg">
              <div className="segmented-grid">
                {TRADE_DIRECTIONS.map((direction) => (
                  <button
                    key={direction}
                    type="button"
                    className={`segment-button ${
                      tradeDirection === direction ? 'is-selected' : ''
                    }`}
                    onClick={() => setTradeDirection(direction)}
                  >
                    {direction}
                  </button>
                ))}
              </div>

              <label className="field">
                <span>Trade Date &amp; Time</span>
                <input
                  type="datetime-local"
                  value={tradeDateTime}
                  onChange={(event) => setTradeDateTime(event.target.value)}
                  required
                />
              </label>

              <label className="field">
                <span>Pair / Asset</span>
                <input
                  type="text"
                  value={selectedPair}
                  onChange={(event) => setSelectedPair(event.target.value.toUpperCase())}
                  placeholder="EURUSD, XAUUSD, BTCUSD, NAS100..."
                />
              </label>

              <div className="chip-grid">
                {PAIRS.map((pair) => (
                  <button
                    key={pair}
                    type="button"
                    className={`choice-chip ${selectedPair === pair ? 'is-selected' : ''}`}
                    onClick={() => setSelectedPair(pair)}
                  >
                    {pair}
                  </button>
                ))}
              </div>

              <label className="field">
                <span>Risk : Reward Ratio</span>
                <input
                  type="text"
                  value={riskReward}
                  onChange={(event) => setRiskReward(event.target.value)}
                  placeholder="2.5"
                />
              </label>

              <label className="field">
                <span>P&amp;L</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={pnl}
                  onChange={(event) => setPnl(event.target.value)}
                  placeholder="125.50"
                />
              </label>

              <label className="field">
                <span>P&amp;L %</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={pnlPercentage}
                  onChange={(event) => setPnlPercentage(event.target.value)}
                  placeholder="2.35"
                />
              </label>

              <div className="result-grid">
                {TRADE_RESULTS.map((result) => (
                  <button
                    key={result}
                    type="button"
                    className={`result-card ${tradeResult === result ? 'is-selected' : ''}`}
                    style={{ '--result-color': getResultColor(result) }}
                    onClick={() => setTradeResult(result)}
                  >
                    <strong>{result}</strong>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="detail-stat-grid">
              {detailCards.map((item) => (
                <div key={item.label} className="detail-stat">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="surface-card detail-card">
          <div className="section-heading">
            <div>
              <span className="section-heading__eyebrow">Discipline Review</span>
              <h2>Validation</h2>
            </div>
          </div>

          {isEditing ? (
            <div className="stack-lg">
              <button
                type="button"
                className={`checkbox-row ${isFollowingPlan ? 'is-checked' : ''}`}
                onClick={() => setIsFollowingPlan((value) => !value)}
              >
                <span className="checkbox-row__box">
                  {isFollowingPlan ? <IoCheckmarkCircle size={18} /> : null}
                </span>
                <div>
                  <strong>Am I following my trading plan?</strong>
                  <p>Keep this in sync with the journal and calendar views.</p>
                </div>
              </button>

              <label className="field">
                <span>Emotional State</span>
                <input
                  type="text"
                  value={emotionalState}
                  onChange={(event) => setEmotionalState(event.target.value)}
                  placeholder="How were you feeling during this trade?"
                />
              </label>
            </div>
          ) : (
            <div className="detail-stat-grid">
              <div className="detail-stat">
                <span>Following Plan</span>
                <strong>{isFollowingPlan ? 'Yes' : 'Needs Review'}</strong>
              </div>
              <div className="detail-stat">
                <span>Emotional State</span>
                <strong>{emotionalState || 'Not recorded'}</strong>
              </div>
            </div>
          )}
        </article>

        <article className="surface-card detail-card">
          <div className="section-heading">
            <div>
              <span className="section-heading__eyebrow">Notes</span>
              <h2>Trade reflection</h2>
            </div>
          </div>

          {isEditing ? (
            <label className="field">
              <span>Notes</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add your trade notes here..."
              />
            </label>
          ) : (
            <p className="detail-notes">{notes || 'No notes recorded for this entry.'}</p>
          )}
        </article>

        <article className="surface-card detail-card">
          <div className="section-heading">
            <div>
              <span className="section-heading__eyebrow">Execution</span>
              <h2>Execution timeframe image</h2>
            </div>
          </div>

          {executionImage ? (
            <div className="image-preview-card">
              <button
                type="button"
                className="image-preview-trigger"
                onClick={() =>
                  openImagePreview(executionImage, 'Execution timeframe image', 'execution')
                }
              >
                <img src={executionImage} alt="Execution timeframe" />
              </button>
            </div>
          ) : (
            <EmptyState
              title="No execution image"
              description="Upload one while editing to use this page together with Execution Review."
            />
          )}

          {isEditing ? (
            <>
              <div className="button-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => executionInputRef.current?.click()}
                >
                  <IoCloudUploadOutline size={18} />
                  Browse
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => executionCameraRef.current?.click()}
                >
                  <IoCameraOutline size={18} />
                  Camera
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setExecutionAsset(null)}
                >
                  Remove
                </button>
              </div>
              <input
                ref={executionInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) =>
                  handleSingleAsset(
                    setExecutionAsset,
                    executionAsset,
                    event.target.files?.[0]
                  )
                }
              />
              <input
                ref={executionCameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(event) =>
                  handleSingleAsset(
                    setExecutionAsset,
                    executionAsset,
                    event.target.files?.[0]
                  )
                }
              />
            </>
          ) : null}
        </article>

        <article className="surface-card detail-card detail-card--full">
          <div className="section-heading">
            <div>
              <span className="section-heading__eyebrow">Gallery</span>
              <h2>Additional images</h2>
            </div>
            {isEditing ? (
              <div className="button-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => galleryInputRef.current?.click()}
                >
                  <IoImagesOutline size={18} />
                  Add Images
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => galleryCameraRef.current?.click()}
                >
                  <IoCameraOutline size={18} />
                  Camera
                </button>
              </div>
            ) : null}
          </div>

          {galleryItems.length > 0 ? (
            <div className="gallery-grid">
              {galleryItems.map((item, index) => (
                <figure key={item.id} className="gallery-card">
                  <button
                    type="button"
                    className="gallery-image-trigger"
                    onClick={() =>
                        openImagePreview(item.url, `Additional image ${index + 1}`, `gallery-${index + 1}`)
                    }
                  >
                    <img src={item.url} alt={`Gallery asset ${index + 1}`} />
                  </button>
                  {isEditing ? (
                    <button
                      type="button"
                      className="icon-button gallery-card__remove"
                      onClick={() =>
                        setGalleryItems((current) =>
                          current.filter((_, currentIndex) => currentIndex !== index)
                        )
                      }
                    >
                      <IoTrashOutline size={16} />
                    </button>
                  ) : null}
                </figure>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No gallery images"
              description="Add more screenshots here if you want extra context beyond the primary setup and execution images."
            />
          )}

          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => handleGalleryFiles(event.target.files)}
          />
          <input
            ref={galleryCameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            hidden
            onChange={(event) => handleGalleryFiles(event.target.files)}
          />
        </article>

      </section>

      {isEditing ? (
        <section className="surface-card save-panel">
          <div>
            <span className="section-heading__eyebrow">Save Changes</span>
            <h2>Update trade review</h2>
            <p>
              {isUploading
                ? 'Uploading images before saving your changes.'
                : 'This will update the same backend record used by the journal, calendar, and analytics pages.'}
            </p>
          </div>
          <button
            type="button"
            className="primary-button"
            disabled={isSaving}
            onClick={handleSave}
          >
            {isSaving ? <IoCloudUploadOutline size={18} /> : <IoShieldCheckmarkOutline size={18} />}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </section>
      ) : null}

    </div>
  );
}
