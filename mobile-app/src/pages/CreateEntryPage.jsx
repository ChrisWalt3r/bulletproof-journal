import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  IoAdd,
  IoArrowBack,
  IoCameraOutline,
  IoCheckmarkCircle,
  IoCloudUploadOutline,
  IoDocumentTextOutline,
  IoPulseOutline,
  IoShieldCheckmarkOutline,
  IoStatsChartOutline,
} from 'react-icons/io5';
import PageHeader from '../components/PageHeader.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';
import { useAccount } from '../context/AccountContext.jsx';
import { imageAPI, journalAPI } from '../services/api.js';
import {
  buildManualEntryContent,
  formatManualTradeDateLabel,
  getResultColor,
  PAIRS,
  TRADE_DIRECTIONS,
  TRADE_RESULTS,
} from '../utils/tradeUtils.js';

const formatForDateTimeInput = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
};

const toTimestamp = (dateTimeInput) => {
  const parsed = new Date(dateTimeInput);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
};
const PLAN_STATUS_OPTIONS = [
  { id: 'FOLLOWED', label: 'Followed Plan', followingPlan: true },
  { id: 'NOT_FOLLOWED', label: 'Did Not Follow Plan', followingPlan: false },
  { id: 'NOT_RECORDED', label: 'Needs Review', followingPlan: null },
];

const createPreviewAsset = (file) => ({
  id: `${file.name}-${file.lastModified}-${Math.random().toString(16).slice(2)}`,
  file,
  preview: URL.createObjectURL(file),
});

const revokePreviewAsset = (asset) => {
  if (asset?.preview?.startsWith('blob:')) {
    URL.revokeObjectURL(asset.preview);
  }
};

export default function CreateEntryPage() {
  const navigate = useNavigate();
  const { currentAccount } = useAccount();
  const [selectedPair, setSelectedPair] = useState('');
  const [tradeDirection, setTradeDirection] = useState('');
  const [tradeResult, setTradeResult] = useState('');
  const [riskReward, setRiskReward] = useState('');
  const [pnl, setPnl] = useState('');
  const [pnlPercentage, setPnlPercentage] = useState('');
  const [planStatus, setPlanStatus] = useState('');
  const [tradeDateTime, setTradeDateTime] = useState(() => formatForDateTimeInput());
  const [emotionalState, setEmotionalState] = useState('');
  const [notes, setNotes] = useState('');

  const [setupFile, setSetupFile] = useState(null);
  const [setupPreview, setSetupPreview] = useState('');
  const [executionFile, setExecutionFile] = useState(null);
  const [executionPreview, setExecutionPreview] = useState('');
  const [additionalAssets, setAdditionalAssets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [expandedImage, setExpandedImage] = useState('');

  const setupGalleryInputRef = useRef(null);
  const setupCameraInputRef = useRef(null);
  const executionGalleryInputRef = useRef(null);
  const executionCameraInputRef = useRef(null);
  const additionalGalleryInputRef = useRef(null);
  const additionalCameraInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (setupPreview.startsWith('blob:')) {
        URL.revokeObjectURL(setupPreview);
      }

      if (executionPreview.startsWith('blob:')) {
        URL.revokeObjectURL(executionPreview);
      }

      additionalAssets.forEach(revokePreviewAsset);
    };
  }, [additionalAssets, executionPreview, setupPreview]);

  const handleSetupImage = (file) => {
    if (!file) {
      return;
    }

    if (setupPreview.startsWith('blob:')) {
      URL.revokeObjectURL(setupPreview);
    }

    setSetupFile(file);
    setSetupPreview(URL.createObjectURL(file));
  };

  const handleExecutionImage = (file) => {
    if (!file) {
      return;
    }

    if (executionPreview.startsWith('blob:')) {
      URL.revokeObjectURL(executionPreview);
    }

    setExecutionFile(file);
    setExecutionPreview(URL.createObjectURL(file));
  };

  const handleAdditionalImages = (files) => {
    const list = Array.from(files || []);
    if (!list.length) {
      return;
    }

    const slots = Math.max(0, 5 - additionalAssets.length);
    if (!slots) {
      window.alert('You can upload up to 5 additional images.');
      return;
    }

    const next = list.slice(0, slots).map((file) => createPreviewAsset(file));
    setAdditionalAssets((current) => [...current, ...next]);
  };

  const removeAdditionalImage = (id) => {
    setAdditionalAssets((current) => {
      const target = current.find((asset) => asset.id === id);
      if (target) {
        revokePreviewAsset(target);
      }
      return current.filter((asset) => asset.id !== id);
    });
  };

  const handleSave = async () => {
    if (isLoading) {
      return;
    }

    const normalizedPair = selectedPair.trim().toUpperCase();
    if (!normalizedPair) {
      window.alert('Please enter a pair or asset symbol.');
      return;
    }

    if (!tradeDirection) {
      window.alert('Please select a trade direction.');
      return;
    }

    if (!tradeResult) {
      window.alert('Please select a trade result.');
      return;
    }

    if (!riskReward.trim()) {
      window.alert('Please provide the Risk : Reward ratio.');
      return;
    }

    const numericPnl = Number(pnl);
    if (!Number.isFinite(numericPnl)) {
      window.alert('Please provide a valid P&L value.');
      return;
    }

    const numericPnlPercentage = Number(pnlPercentage);
    if (!Number.isFinite(numericPnlPercentage)) {
      window.alert('Please provide a valid P&L % value.');
      return;
    }

    if (!planStatus) {
      window.alert('Please select a plan status.');
      return;
    }

    if (!tradeDateTime.trim() || Number.isNaN(new Date(tradeDateTime).getTime())) {
      window.alert('Please provide a valid trade date and time.');
      return;
    }

    if (!emotionalState.trim()) {
      window.alert('Please provide your emotional state for this trade.');
      return;
    }

    if (!setupFile) {
      window.alert('Please upload a primary setup image.');
      return;
    }

    if (!executionFile) {
      window.alert('Please upload an execution timeframe image.');
      return;
    }

    setIsLoading(true);

    try {
      const followingPlanValue = PLAN_STATUS_OPTIONS.find(
        (option) => option.id === planStatus
      )?.followingPlan;

      setIsUploading(true);
      const setupUpload = await imageAPI.uploadImage(setupFile);
      const executionUpload = await imageAPI.uploadImage(executionFile);
      const uploadedAdditionalImages = [];
      for (const asset of additionalAssets) {
        const uploadResult = await imageAPI.uploadImage(asset.file);
        uploadedAdditionalImages.push(uploadResult.imageUrl);
      }

      setIsUploading(false);

      const title = `Manual Trade - ${normalizedPair} - ${formatManualTradeDateLabel(
        tradeDateTime
      )}`;
      const moodRating =
        tradeResult === 'WIN' ? 8 : tradeResult === 'BREAKEVEN' ? 6 : 3;

      const content = buildManualEntryContent({
        selectedPair: normalizedPair,
        tradeDirection,
        tradeResult,
        riskReward,
        pnl: numericPnl,
        pnlPercentage: numericPnlPercentage,
        planStatus,
        emotionalState,
        notes,
        tradeDateTime,
        hasSetupImage: true,
        hasExecutionImage: true,
        additionalImageCount: uploadedAdditionalImages.length,
      });

      await journalAPI.createEntry({
        title,
        content,
        moodRating,
        tags: [
          'trading',
          'manual',
          tradeResult.toLowerCase(),
          normalizedPair.toLowerCase(),
        ],
        imageUrl: setupUpload.imageUrl,
        imageFilename: setupUpload.filename,
        executionTfImageUrl: executionUpload.imageUrl,
        executionTfImageFilename: executionUpload.filename,
        galleryImages: uploadedAdditionalImages,
        accountId: currentAccount?.id,
        symbol: normalizedPair,
        direction: tradeDirection,
        pnl: numericPnl,
        pnlPercentage: numericPnlPercentage,
        planNotes: notes || null,
        reasonMindset: emotionalState,
        followingPlan: followingPlanValue,
        emotionalState,
        notes,
        createdAt: toTimestamp(tradeDateTime),
      });

      window.alert('Your trading journal entry has been saved.');
      navigate('/journal');
    } catch (error) {
      console.error('Failed to create entry', error);
      window.alert('Failed to save the journal entry.');
    } finally {
      setIsUploading(false);
      setIsLoading(false);
    }
  };

  if (!currentAccount) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="New Entry"
          title="Create a trade entry"
          subtitle="You need an active account before you can save a journal entry."
        />
        <EmptyState
          title="No account selected"
          description="Open settings first, then activate or create an account."
          action={
            <Link className="primary-button" to="/settings">
              Go to Settings
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="New Entry"
        title="Record a trade"
        subtitle="Capture the setup, pair, result, notes, and validation details in the same flow you had on mobile."
        actions={
          <Link className="ghost-button" to="/journal">
            <IoArrowBack size={18} />
            Back to Journal
          </Link>
        }
      />

      <section className="form-layout">
        <article className="surface-card form-card">
          <div className="section-heading">
            <div>
              <span className="section-heading__eyebrow">Setup</span>
              <h2>Setup image</h2>
            </div>
          </div>

          {setupPreview ? (
            <div className="image-preview-card">
              <button
                type="button"
                className="image-preview-trigger"
                onClick={() => setExpandedImage(setupPreview)}
              >
                <img src={setupPreview} alt="Selected setup" />
              </button>
              <div className="button-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setupGalleryInputRef.current?.click()}
                >
                  <IoCloudUploadOutline size={18} />
                  Replace
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    if (setupPreview.startsWith('blob:')) {
                      URL.revokeObjectURL(setupPreview);
                    }
                    setSetupFile(null);
                    setSetupPreview('');
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="upload-dropzone">
              <span className="upload-dropzone__icon">
                <IoCameraOutline size={28} />
              </span>
              <strong>Add setup image</strong>
              <p>Choose an image from your device or open the camera on supported browsers.</p>
              <div className="button-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setupGalleryInputRef.current?.click()}
                >
                  <IoCloudUploadOutline size={18} />
                  Browse Files
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setupCameraInputRef.current?.click()}
                >
                  <IoCameraOutline size={18} />
                  Use Camera
                </button>
              </div>
            </div>
          )}

          <input
            ref={setupGalleryInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => handleSetupImage(event.target.files?.[0])}
          />
          <input
            ref={setupCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(event) => handleSetupImage(event.target.files?.[0])}
          />

        </article>

        <article className="surface-card form-card">
          <div className="section-heading">
            <div>
              <span className="section-heading__eyebrow">Trading Information</span>
              <h2>Trade details</h2>
            </div>
          </div>

          <div className="field-group">
            <label className="field">
              <span>Pair / Asset</span>
              <input
                type="text"
                value={selectedPair}
                onChange={(event) => setSelectedPair(event.target.value.toUpperCase())}
                placeholder="EURUSD, XAUUSD, BTCUSD, NAS100..."
                list="pair-suggestions"
              />
            </label>

            <label className="field">
              <span>Trade Date &amp; Time</span>
              <input
                type="datetime-local"
                value={tradeDateTime}
                onChange={(event) => setTradeDateTime(event.target.value)}
                required
              />
            </label>

            <datalist id="pair-suggestions">
              {PAIRS.map((pair) => (
                <option key={pair} value={pair} />
              ))}
            </datalist>
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
          </div>

          <div className="field-group">
            <label className="field">
              <span>Trade Direction</span>
            </label>
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
                  <IoStatsChartOutline size={18} />
                  {direction}
                </button>
              ))}
            </div>
          </div>

          <div className="field-group">
            <label className="field">
              <span>Risk : Reward Ratio</span>
              <input
                type="text"
                inputMode="decimal"
                value={riskReward}
                onChange={(event) => setRiskReward(event.target.value)}
                placeholder="2.5"
              />
            </label>
          </div>

          <div className="field-group">
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
          </div>

          <div className="field-group">
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
          </div>
        </article>

        <article className="surface-card form-card">
          <div className="section-heading">
            <div>
              <span className="section-heading__eyebrow">Trade Outcome</span>
              <h2>Result</h2>
            </div>
          </div>

          <div className="result-grid">
            {TRADE_RESULTS.map((result) => (
              <button
                key={result}
                type="button"
                className={`result-card ${tradeResult === result ? 'is-selected' : ''}`}
                style={{ '--result-color': getResultColor(result) }}
                onClick={() => setTradeResult(result)}
              >
                <span className="result-card__icon">
                  <IoPulseOutline size={18} />
                </span>
                <strong>{result}</strong>
              </button>
            ))}
          </div>
        </article>

        <article className="surface-card form-card">
          <div className="section-heading">
            <div>
              <span className="section-heading__eyebrow">Emotional State</span>
              <h2>How were you feeling during this trade?</h2>
            </div>
          </div>

          <label className="field">
            <span>Emotional State</span>
            <textarea
              value={emotionalState}
              onChange={(event) => setEmotionalState(event.target.value)}
              placeholder="How were you feeling during this trade?"
            />
          </label>
        </article>

        <article className="surface-card form-card">
          <div className="section-heading">
            <div>
              <span className="section-heading__eyebrow">Plan Status</span>
              <h2>Discipline check</h2>
            </div>
          </div>

          <div className="result-grid">
            {PLAN_STATUS_OPTIONS.map((status) => (
              <button
                key={status.id}
                type="button"
                className={`result-card ${planStatus === status.id ? 'is-selected' : ''}`}
                onClick={() => setPlanStatus(status.id)}
              >
                <span className="result-card__icon">
                  <IoShieldCheckmarkOutline size={18} />
                </span>
                <strong>{status.label}</strong>
              </button>
            ))}
          </div>
        </article>

        <article className="surface-card form-card">
          <div className="section-heading">
            <div>
              <span className="section-heading__eyebrow">Execution</span>
              <h2>Execution timeframe image</h2>
            </div>
          </div>

          {executionPreview ? (
            <div className="image-preview-card">
              <button
                type="button"
                className="image-preview-trigger"
                onClick={() => setExpandedImage(executionPreview)}
              >
                <img src={executionPreview} alt="Execution timeframe" />
              </button>
              <div className="button-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => executionGalleryInputRef.current?.click()}
                >
                  <IoCloudUploadOutline size={18} />
                  Replace
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    if (executionPreview.startsWith('blob:')) {
                      URL.revokeObjectURL(executionPreview);
                    }
                    setExecutionFile(null);
                    setExecutionPreview('');
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="upload-dropzone">
              <span className="upload-dropzone__icon">
                <IoCameraOutline size={28} />
              </span>
              <strong>Add execution timeframe image</strong>
              <p>Upload the image that captures your entry and execution timing context.</p>
              <div className="button-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => executionGalleryInputRef.current?.click()}
                >
                  <IoCloudUploadOutline size={18} />
                  Browse Files
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => executionCameraInputRef.current?.click()}
                >
                  <IoCameraOutline size={18} />
                  Use Camera
                </button>
              </div>
            </div>
          )}

          <input
            ref={executionGalleryInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => handleExecutionImage(event.target.files?.[0])}
          />
          <input
            ref={executionCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(event) => handleExecutionImage(event.target.files?.[0])}
          />
        </article>

        <article className="surface-card form-card">
          <div className="section-heading">
            <div>
              <span className="section-heading__eyebrow">Execution</span>
              <h2>Additional images (optional)</h2>
            </div>
          </div>

          <div className="button-row">
            <button
              type="button"
              className="secondary-button"
              onClick={() => additionalGalleryInputRef.current?.click()}
            >
              <IoAdd size={18} />
              Add Images
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => additionalCameraInputRef.current?.click()}
            >
              <IoCameraOutline size={18} />
              Use Camera
            </button>
          </div>

          {additionalAssets.length ? (
            <div className="execution-grid">
              {additionalAssets.map((asset) => (
                <div key={asset.id} className="execution-card">
                  <button
                    type="button"
                    className="image-preview-trigger"
                    onClick={() => setExpandedImage(asset.preview)}
                  >
                    <img src={asset.preview} alt="Additional trade context" />
                  </button>
                  <div className="execution-card__body">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => removeAdditionalImage(asset.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <input
            ref={additionalGalleryInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => handleAdditionalImages(event.target.files)}
          />
          <input
            ref={additionalCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            hidden
            onChange={(event) => handleAdditionalImages(event.target.files)}
          />
        </article>

        <article className="surface-card form-card">
          <div className="section-heading">
            <div>
              <span className="section-heading__eyebrow">Notes</span>
              <h2>Optional notes</h2>
            </div>
          </div>

          <label className="field">
            <span>Trade Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Any notes about this trade..."
            />
          </label>
        </article>

        <article className="surface-card form-card">
          <div className="section-heading">
            <div>
              <span className="section-heading__eyebrow">Checklist</span>
              <h2>Required fields</h2>
            </div>
          </div>

          <div className="stack-lg">
            <p>
              Provide: Pair/Asset, Direction, Outcome, Risk : Reward, P&amp;L, P&amp;L %,
              Plan Status, Emotional State, Trade Date &amp; Time, Primary image, and Execution timeframe image.
            </p>
            <button
              type="button"
              className={`checkbox-row ${Boolean(setupFile && executionFile) ? 'is-checked' : ''}`}
            >
              <span className="checkbox-row__box">
                {setupFile && executionFile ? <IoCheckmarkCircle size={18} /> : null}
              </span>
              <div>
                <strong>Images ready</strong>
                <p>Primary setup and execution timeframe images are both required.</p>
              </div>
            </button>
          </div>
        </article>
      </section>

      <section className="surface-card save-panel">
        <div>
          <span className="section-heading__eyebrow">Ready to Save</span>
          <h2>Manual journal entry</h2>
          <p>
            This will save to <strong>{currentAccount.name}</strong> and keep the same
            backend entry format used by the mobile app.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          disabled={isLoading}
          onClick={handleSave}
        >
          {isUploading ? <IoCloudUploadOutline size={18} /> : <IoDocumentTextOutline size={18} />}
          {isUploading ? 'Uploading Image...' : isLoading ? 'Saving Entry...' : 'Save Trading Journal'}
        </button>
      </section>

      <Modal
        open={Boolean(expandedImage)}
        title="Setup image"
        onClose={() => setExpandedImage('')}
        fullscreen
      >
        <div className="image-lightbox">
          {expandedImage ? <img src={expandedImage} alt="Expanded setup preview" /> : null}
        </div>
      </Modal>
    </div>
  );
}
