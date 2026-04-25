import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
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
import { useAccount } from '../context/AccountContext.jsx';
import { imageAPI, journalAPI } from '../services/api.js';
import {
  buildManualEntryContent,
  getCurrentKampalaDateLabel,
  getResultColor,
  PAIRS,
  TRADE_DIRECTIONS,
  TRADE_RESULTS,
} from '../utils/tradeUtils.js';

const toTimestamp = () => new Date().toISOString();

export default function CreateEntryPage() {
  const navigate = useNavigate();
  const { currentAccount } = useAccount();
  const [selectedPair, setSelectedPair] = useState('');
  const [tradeDirection, setTradeDirection] = useState('');
  const [tradeResult, setTradeResult] = useState('');
  const [riskReward, setRiskReward] = useState('');
  const [notes, setNotes] = useState('');
  const [isFollowingPlan, setIsFollowingPlan] = useState(false);
  const [emotionalState, setEmotionalState] = useState('');
  const [setupFile, setSetupFile] = useState(null);
  const [setupPreview, setSetupPreview] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (setupPreview.startsWith('blob:')) {
        URL.revokeObjectURL(setupPreview);
      }
    };
  }, [setupPreview]);

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

  const handleSave = async () => {
    if (isLoading) {
      return;
    }

    if (!selectedPair) {
      window.alert('Please select a trading pair.');
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

    setIsLoading(true);

    try {
      let imageUrl = null;
      let imageFilename = null;

      if (setupFile) {
        setIsUploading(true);
        const uploadResult = await imageAPI.uploadImage(setupFile);
        imageUrl = uploadResult.imageUrl;
        imageFilename = uploadResult.filename;
        setIsUploading(false);
      }

      const title = `Forex Trade - ${getCurrentKampalaDateLabel()}`;
      const moodRating =
        tradeResult === 'WIN' ? 8 : tradeResult === 'BREAKEVEN' ? 6 : 3;
      const content = buildManualEntryContent({
        selectedPair,
        tradeDirection,
        tradeResult,
        riskReward,
        notes,
        hasSetupImage: Boolean(setupFile),
      });

      await journalAPI.createEntry({
        title,
        content,
        moodRating,
        tags: [
          'forex',
          'trading',
          tradeResult.toLowerCase(),
          selectedPair.toLowerCase(),
        ],
        imageUrl,
        imageFilename,
        accountId: currentAccount?.id,
        followingPlan: isFollowingPlan,
        emotionalState,
        notes,
        createdAt: toTimestamp(),
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
              <span className="section-heading__eyebrow">Setup Analysis</span>
              <h2>Setup image</h2>
            </div>
          </div>

          {setupPreview ? (
            <div className="image-preview-card">
              <img src={setupPreview} alt="Selected setup" />
              <div className="button-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => galleryInputRef.current?.click()}
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
                  onClick={() => galleryInputRef.current?.click()}
                >
                  <IoCloudUploadOutline size={18} />
                  Browse Files
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <IoCameraOutline size={18} />
                  Use Camera
                </button>
              </div>
            </div>
          )}

          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => handleSetupImage(event.target.files?.[0])}
          />
          <input
            ref={cameraInputRef}
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
              <span>Currency Pair</span>
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
              <span className="section-heading__eyebrow">Notes</span>
              <h2>Context</h2>
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
              <span className="section-heading__eyebrow">Trade Validation</span>
              <h2>Discipline check</h2>
            </div>
          </div>

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
              <p>Keep the same plan adherence flag used throughout the rest of the app.</p>
            </div>
          </button>

          <label className="field">
            <span>Emotional State</span>
            <input
              type="text"
              value={emotionalState}
              onChange={(event) => setEmotionalState(event.target.value)}
              placeholder="How are you feeling right now?"
            />
          </label>
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
    </div>
  );
}
