import { useEffect, useMemo, useState } from 'react';
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  IoAdd,
  IoCheckmark,
  IoHelpCircleOutline,
  IoMenu,
  IoPencil,
  IoRefresh,
  IoTrashOutline,
} from 'react-icons/io5';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';
import EmptyState from '../components/EmptyState.jsx';
import {
  addCriterionToPlan,
  createTradingPlan,
  deleteCriterion,
  deleteTradingPlan,
  getCriteriaForPlan,
  getTradingPlans,
  renameTradingPlan,
  reorderCriteria,
  resetPlanCriteria,
  toggleCriterionChecked,
  updateCriterionText,
} from '../database/service.js';

const tooltipData = {
  expectations: {
    title: 'What are my expectations?',
    content:
      'Dump your expectations on the outcome of this trade. What do you think the market will give you, and how attached are you to that outcome?',
  },
  tpCriteria: {
    title: 'Does the trade meet my criteria?',
    content:
      'If the answer is not clearly yes, your checklist probably needs refining. The goal is binary clarity before you act.',
  },
  emotion: {
    title: 'Emotion',
    content:
      'Track how emotionally charged you were. This log is about awareness, not judgment.',
  },
  notes: {
    title: 'Notes and refinements',
    content:
      'Write the action steps that move you away from outcome-focused thinking and back toward process.',
  },
};

const mindsetPhases = ['Waiting', 'Pre-Trade', 'In Trade', 'Stop Loss', 'Take Profit'];

const emotionOptions = [
  { value: 'very-positive', label: 'Great', emoji: ':-)', color: '#16a34a' },
  { value: 'positive', label: 'Good', emoji: ':)', color: '#22c55e' },
  { value: 'neutral', label: 'Okay', emoji: ':|', color: '#f59e0b' },
  { value: 'negative', label: 'Bad', emoji: ':(', color: '#ef4444' },
  { value: 'very-negative', label: 'Awful', emoji: ':/', color: '#b91c1c' },
];

function SortableCriterionItem({
  item,
  editingCriterionId,
  editingCriterionText,
  setEditingCriterionText,
  onStartEditing,
  onSaveEditing,
  onToggle,
  onDelete,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`criterion-card ${isDragging ? 'is-dragging' : ''}`}
    >
      <button
        type="button"
        className="icon-button criterion-card__drag"
        {...attributes}
        {...listeners}
      >
        <IoMenu size={18} />
      </button>

      <button
        type="button"
        className={`criterion-card__check ${item.checked ? 'is-checked' : ''}`}
        onClick={() => onToggle(item.id, item.checked)}
      >
        {item.checked ? <IoCheckmark size={16} /> : null}
      </button>

      <div className="criterion-card__copy">
        {editingCriterionId === item.id ? (
          <input
            className="criterion-card__input"
            value={editingCriterionText}
            onChange={(event) => setEditingCriterionText(event.target.value)}
            onBlur={onSaveEditing}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onSaveEditing();
              }
            }}
            autoFocus
          />
        ) : (
          <button
            type="button"
            className="criterion-card__text"
            onClick={() => onStartEditing(item)}
          >
            {item.text}
          </button>
        )}
      </div>

      <button
        type="button"
        className="icon-button"
        onClick={() => onDelete(item.id)}
      >
        <IoTrashOutline size={18} />
      </button>
    </div>
  );
}

export default function CriteriaPage() {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [plans, setPlans] = useState([]);
  const [activePlanId, setActivePlanId] = useState(null);
  const [planNameInput, setPlanNameInput] = useState('');
  const [isRenamingPlanId, setIsRenamingPlanId] = useState(null);
  const [criteriaByPlan, setCriteriaByPlan] = useState({});
  const [newCriterionText, setNewCriterionText] = useState('');
  const [editingCriterionId, setEditingCriterionId] = useState(null);
  const [editingCriterionText, setEditingCriterionText] = useState('');
  const [mindsetEntries, setMindsetEntries] = useState([]);
  const [tooltipKey, setTooltipKey] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlans = async () => {
      setLoading(true);
      try {
        let existingPlans = await getTradingPlans();

        if (!existingPlans.length) {
          const defaultPlan = await createTradingPlan('My Trading Plan');
          existingPlans = [defaultPlan];
        }

        setPlans(existingPlans);
        setActivePlanId(existingPlans[0]?.id ?? null);

        const nextCriteriaByPlan = {};
        for (const plan of existingPlans) {
          nextCriteriaByPlan[plan.id] = await getCriteriaForPlan(plan.id);
        }
        setCriteriaByPlan(nextCriteriaByPlan);
      } catch (error) {
        console.error('Failed to load trading plans', error);
        window.alert('Failed to load trading plans.');
      } finally {
        setLoading(false);
      }
    };

    loadPlans();
  }, []);

  const activePlanCriteria = criteriaByPlan[activePlanId] || [];
  const activePlan = plans.find((plan) => plan.id === activePlanId) || null;

  const progress = useMemo(() => {
    const completed = activePlanCriteria.filter((criterion) => criterion.checked).length;
    const total = activePlanCriteria.length;
    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [activePlanCriteria]);

  const handleAddPlan = async () => {
    const trimmed = planNameInput.trim();
    if (!trimmed) {
      window.alert('Please enter a plan name.');
      return;
    }

    const newPlan = await createTradingPlan(trimmed);
    setPlans((current) => [...current, newPlan]);
    setCriteriaByPlan((current) => ({ ...current, [newPlan.id]: [] }));
    setActivePlanId(newPlan.id);
    setPlanNameInput('');
    setIsRenamingPlanId(null);
  };

  const handleRenamePlan = async () => {
    const trimmed = planNameInput.trim();
    if (!trimmed || !isRenamingPlanId) {
      return;
    }

    const updatedPlan = await renameTradingPlan(isRenamingPlanId, trimmed);
    setPlans((current) =>
      current.map((plan) => (plan.id === isRenamingPlanId ? updatedPlan : plan))
    );
    setPlanNameInput('');
    setIsRenamingPlanId(null);
  };

  const handleDeletePlan = async (planId) => {
    if (!window.confirm('Delete this trading plan and all its criteria?')) {
      return;
    }

    await deleteTradingPlan(planId);

    setPlans((current) => current.filter((plan) => plan.id !== planId));
    setCriteriaByPlan((current) => {
      const copy = { ...current };
      delete copy[planId];
      return copy;
    });

    const remainingPlans = plans.filter((plan) => plan.id !== planId);
    setActivePlanId(remainingPlans[0]?.id ?? null);
  };

  const handleAddCriterion = async () => {
    if (!activePlanId) {
      window.alert('Select a plan first.');
      return;
    }

    const trimmed = newCriterionText.trim();
    if (!trimmed) {
      window.alert('Please enter criterion text.');
      return;
    }

    const newCriterion = await addCriterionToPlan(activePlanId, trimmed);
    setCriteriaByPlan((current) => ({
      ...current,
      [activePlanId]: [...(current[activePlanId] || []), newCriterion],
    }));
    setNewCriterionText('');
  };

  const handleToggleCriterion = async (criterionId, checked) => {
    const updated = await toggleCriterionChecked(criterionId, !checked, activePlanId);
    setCriteriaByPlan((current) => ({
      ...current,
      [activePlanId]: current[activePlanId].map((criterion) =>
        criterion.id === criterionId ? updated : criterion
      ),
    }));
  };

  const handleSaveCriterionEdit = async () => {
    const trimmed = editingCriterionText.trim();
    if (!trimmed || !editingCriterionId) {
      setEditingCriterionId(null);
      setEditingCriterionText('');
      return;
    }

    const updated = await updateCriterionText(
      editingCriterionId,
      trimmed,
      activePlanId
    );
    setCriteriaByPlan((current) => ({
      ...current,
      [activePlanId]: current[activePlanId].map((criterion) =>
        criterion.id === editingCriterionId ? updated : criterion
      ),
    }));
    setEditingCriterionId(null);
    setEditingCriterionText('');
  };

  const handleDeleteCriterion = async (criterionId) => {
    if (!window.confirm('Delete this criterion?')) {
      return;
    }

    await deleteCriterion(criterionId, activePlanId);
    setCriteriaByPlan((current) => ({
      ...current,
      [activePlanId]: current[activePlanId].filter(
        (criterion) => criterion.id !== criterionId
      ),
    }));
  };

  const handleResetCriteria = async () => {
    if (!window.confirm('Uncheck every rule in this plan?')) {
      return;
    }

    const updatedCriteria = await resetPlanCriteria(activePlanId);
    setCriteriaByPlan((current) => ({
      ...current,
      [activePlanId]: updatedCriteria,
    }));
  };

  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = activePlanCriteria.findIndex((criterion) => criterion.id === active.id);
    const newIndex = activePlanCriteria.findIndex((criterion) => criterion.id === over.id);
    const reordered = arrayMove(activePlanCriteria, oldIndex, newIndex);

    setCriteriaByPlan((current) => ({
      ...current,
      [activePlanId]: reordered,
    }));

    await reorderCriteria(activePlanId, reordered);
  };

  const addMindsetEntry = () => {
    setMindsetEntries((current) => [
      ...current,
      {
        id: Date.now(),
        phase: 'Waiting',
        beforeTrade: {
          expectations: '',
          meetsCriteria: '',
        },
        afterTrade: {
          emotion: '',
          notes: '',
        },
      },
    ]);
  };

  const updateMindsetEntry = (id, field, subfield, value) => {
    setMindsetEntries((current) =>
      current.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              [field]: {
                ...entry[field],
                [subfield]: value,
              },
            }
          : entry
      )
    );
  };

  const updateMindsetPhase = (id, phase) => {
    setMindsetEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, phase } : entry))
    );
  };

  if (loading) {
    return <LoadingScreen message="Loading plans and criteria..." compact />;
  }

  return (
    <div className="page page--criteria">
      <PageHeader
        eyebrow="Criteria"
        title="Criteria"
        subtitle="Manage your plans, checklist, and execution mindset."
      />

      <section className="surface-card">
        <div className="section-heading">
          <div>
            <span className="section-heading__eyebrow">Trading Plans</span>
            <h2>Execution score</h2>
          </div>
          {activePlan ? (
            <div className="progress-pill">
              <strong>{progress.percentage}%</strong>
              <span>
                {progress.completed} of {progress.total} complete
              </span>
            </div>
          ) : null}
        </div>

        <div className="plan-tabs">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              className={`filter-chip ${activePlanId === plan.id ? 'is-active' : ''}`}
              onClick={() => {
                setActivePlanId(plan.id);
                setPlanNameInput('');
                setIsRenamingPlanId(null);
              }}
            >
              {plan.name}
            </button>
          ))}
        </div>

        <div className="button-row">
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              if (!activePlan) {
                return;
              }
              setIsRenamingPlanId(activePlan.id);
              setPlanNameInput(activePlan.name);
            }}
          >
            <IoPencil size={18} />
            Rename
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={handleResetCriteria}
            disabled={!activePlan}
          >
            <IoRefresh size={18} />
            Reset
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => activePlan && handleDeletePlan(activePlan.id)}
            disabled={!activePlan}
          >
            <IoTrashOutline size={18} />
            Delete Plan
          </button>
        </div>

        <div className="inline-form">
          <input
            type="text"
            value={planNameInput}
            onChange={(event) => setPlanNameInput(event.target.value)}
            placeholder={isRenamingPlanId ? 'Rename plan...' : 'Create a new plan...'}
          />
          <button
            type="button"
            className="primary-button"
            onClick={isRenamingPlanId ? handleRenamePlan : handleAddPlan}
          >
            {isRenamingPlanId ? 'Save Name' : 'Add Plan'}
          </button>
        </div>
      </section>

      <section className="surface-card">
        <div className="section-heading">
          <div>
            <span className="section-heading__eyebrow">Acceptance Criteria</span>
            <h2>Checklist</h2>
          </div>
        </div>

        <div className="inline-form">
          <textarea
            value={newCriterionText}
            onChange={(event) => setNewCriterionText(event.target.value)}
            placeholder="Add a new rule, for example: RSI divergence on 1H."
          />
          <button type="button" className="primary-button" onClick={handleAddCriterion}>
            <IoAdd size={18} />
            Add Rule
          </button>
        </div>

        {activePlanCriteria.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={activePlanCriteria.map((criterion) => criterion.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="criterion-list">
                {activePlanCriteria.map((criterion) => (
                  <SortableCriterionItem
                    key={criterion.id}
                    item={criterion}
                    editingCriterionId={editingCriterionId}
                    editingCriterionText={editingCriterionText}
                    setEditingCriterionText={setEditingCriterionText}
                    onStartEditing={(item) => {
                      setEditingCriterionId(item.id);
                      setEditingCriterionText(item.text);
                    }}
                    onSaveEditing={handleSaveCriterionEdit}
                    onToggle={handleToggleCriterion}
                    onDelete={handleDeleteCriterion}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <EmptyState
            title="Your checklist is empty"
            description="Add the rules that define your edge, then drag them into the order you want."
          />
        )}
      </section>

      <section className="surface-card">
        <div className="section-heading">
          <div>
            <span className="section-heading__eyebrow">Psychology Log</span>
            <h2>Track your mindset</h2>
          </div>
          <button type="button" className="primary-button" onClick={addMindsetEntry}>
            <IoAdd size={18} />
            Add Log
          </button>
        </div>

        {mindsetEntries.length > 0 ? (
          <div className="mindset-log-list">
            {mindsetEntries.map((entry, index) => (
              <article key={entry.id} className="mindset-card">
                <div className="mindset-card__header">
                  <strong>Log #{index + 1}</strong>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() =>
                      setMindsetEntries((current) =>
                        current.filter((item) => item.id !== entry.id)
                      )
                    }
                  >
                    <IoTrashOutline size={18} />
                  </button>
                </div>

                <div className="plan-tabs">
                  {mindsetPhases.map((phase) => (
                    <button
                      key={phase}
                      type="button"
                      className={`filter-chip ${entry.phase === phase ? 'is-active' : ''}`}
                      onClick={() => updateMindsetPhase(entry.id, phase)}
                    >
                      {phase}
                    </button>
                  ))}
                </div>

                <div className="mindset-grid">
                  <label className="field">
                    <span>
                      Expectations
                      <button
                        type="button"
                        className="icon-button help-inline"
                        onClick={() => setTooltipKey('expectations')}
                      >
                        <IoHelpCircleOutline size={16} />
                      </button>
                    </span>
                    <textarea
                      value={entry.beforeTrade.expectations}
                      onChange={(event) =>
                        updateMindsetEntry(
                          entry.id,
                          'beforeTrade',
                          'expectations',
                          event.target.value
                        )
                      }
                      placeholder="What are you expecting from this trade?"
                    />
                  </label>

                  <div className="field">
                    <span>
                      Meets Rules?
                      <button
                        type="button"
                        className="icon-button help-inline"
                        onClick={() => setTooltipKey('tpCriteria')}
                      >
                        <IoHelpCircleOutline size={16} />
                      </button>
                    </span>
                    <div className="segmented-grid">
                      {['Yes', 'No'].map((value) => (
                        <button
                          key={value}
                          type="button"
                          className={`segment-button ${
                            entry.beforeTrade.meetsCriteria === value
                              ? 'is-selected'
                              : ''
                          }`}
                          onClick={() =>
                            updateMindsetEntry(
                              entry.id,
                              'beforeTrade',
                              'meetsCriteria',
                              value
                            )
                          }
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="field">
                  <span>
                    Emotional State
                    <button
                      type="button"
                      className="icon-button help-inline"
                      onClick={() => setTooltipKey('emotion')}
                    >
                      <IoHelpCircleOutline size={16} />
                    </button>
                  </span>
                  <div className="emotion-grid">
                    {emotionOptions.map((emotion) => (
                      <button
                        key={emotion.value}
                        type="button"
                        className={`emotion-chip ${
                          entry.afterTrade.emotion === emotion.value ? 'is-selected' : ''
                        }`}
                        style={{
                          '--emotion-color': emotion.color,
                        }}
                        onClick={() =>
                          updateMindsetEntry(
                            entry.id,
                            'afterTrade',
                            'emotion',
                            emotion.value
                          )
                        }
                      >
                        <strong>{emotion.emoji}</strong>
                        <span>{emotion.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <label className="field">
                  <span>
                    Notes
                    <button
                      type="button"
                      className="icon-button help-inline"
                      onClick={() => setTooltipKey('notes')}
                    >
                      <IoHelpCircleOutline size={16} />
                    </button>
                  </span>
                  <textarea
                    value={entry.afterTrade.notes}
                    onChange={(event) =>
                      updateMindsetEntry(
                        entry.id,
                        'afterTrade',
                        'notes',
                        event.target.value
                      )
                    }
                    placeholder="Reflections and refinements..."
                  />
                </label>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No psychology logs yet"
            description="Add a log entry whenever you want to capture expectations, emotions, and refinements around a trade."
          />
        )}
      </section>

      <Modal
        open={Boolean(tooltipKey)}
        title={tooltipKey ? tooltipData[tooltipKey].title : ''}
        onClose={() => setTooltipKey(null)}
      >
        <p>{tooltipKey ? tooltipData[tooltipKey].content : ''}</p>
      </Modal>
    </div>
  );
}
