import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getTradingPlans,
  createTradingPlan,
  renameTradingPlan,
  deleteTradingPlan,
  getCriteriaForPlan,
  addCriterionToPlan,
  updateCriterionText,
  toggleCriterionChecked,
  deleteCriterion,
} from '../database/service';

const CriteriaScreen = () => {
  const [plans, setPlans] = useState([]);
  const [activePlanId, setActivePlanId] = useState(null);
  const [planNameInput, setPlanNameInput] = useState('');
  const [isRenamingPlanId, setIsRenamingPlanId] = useState(null);
  const [criteriaByPlan, setCriteriaByPlan] = useState({}); // { [planId]: [criteria] }
  const [newCriterionText, setNewCriterionText] = useState('');
  const [editingCriterionId, setEditingCriterionId] = useState(null);
  const [editingCriterionText, setEditingCriterionText] = useState('');
  
  // Tooltip state
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipContent, setTooltipContent] = useState('');
  const [tooltipTitle, setTooltipTitle] = useState('');

  // Tooltip content data
  const tooltipData = {
    expectations: {
      title: "What are my expectations?",
      content: "What are you expecting the OUTCOME of this trade to be?\n\nWhat do you think the market is going to give you?\n\nDo you think the market will move in a certain direction?\n\nDo you think this trade will result in a certain profit?\n\nDo you think this trade will give you certain percentage? Or your funded account? Or recognition?\n\nDUMP all your expectations on the outcome..."
    },
    groundExpectations: {
      title: "Ground Expectations",
      content: "Are there not too many factors in the global markets to predict what will happen next?\n\nWho are you to think that you know what's going to happen next?\n\nNobody can predict what will happen on the next individual trade.\n\nAnd you don't need to! You just need to stick to your plan over a large sample space.\n\nGround all outcome based expectations."
    },
    tpCriteria: {
      title: "Does the trade meet my TP criteria?",
      content: "Very simple - YES or NO.\n\nIf you are \"unsure\" this means your trading plan & pre-trade checklist needs to be refined.\n\nIf the answer is No - you do not have an edge - do not trade.\n\nIf the answer is Yes - you have an edge - trade (but make sure you have grounded outcome-based expectations first)."
    },
    emotion: {
      title: "Emotion (+/-)",
      content: "How emotional were you on this trade?\n\nEither positive or negative emotions."
    },
    notes: {
      title: "Notes & Refinements",
      content: "What are the action steps you are going to put in place to ensure you move away from outcome-based expectations to process-based expectations?"
    }
  };
  
  // Trading Mindset entries
  const [mindsetEntries, setMindsetEntries] = useState([]);

  const mindsetPhases = [
    'Waiting for a trade',
    'Just about to take a trade', 
    'Entered a trade',
    'Moving my stop loss',
    'Moving my take profit'
  ];

  const emotionOptions = [
    { value: 'very-positive', label: '😊 Very Positive', score: '+2' },
    { value: 'positive', label: '🙂 Positive', score: '+1' },
    { value: 'neutral', label: '😐 Neutral', score: '0' },
    { value: 'negative', label: '😟 Negative', score: '-1' },
    { value: 'very-negative', label: '😤 Very Negative', score: '-2' },
  ];

  // ---------- Trading Plans & Criteria Logic ----------

  useEffect(() => {
    const loadPlansAndCriteria = async () => {
      try {
        let existingPlans = await getTradingPlans();

        if (!existingPlans || existingPlans.length === 0) {
          const defaultPlan = await createTradingPlan('My Trading Plan');
          existingPlans = [defaultPlan];
        }

        // Enforce max 3 plans in UI (DB can hold more but we won't create beyond 3)
        const limitedPlans = existingPlans.slice(0, 3);
        setPlans(limitedPlans);
        setActivePlanId(limitedPlans[0]?.id ?? null);

        const criteriaMap = {};
        for (const plan of limitedPlans) {
          const criteria = await getCriteriaForPlan(plan.id);
          criteriaMap[plan.id] = criteria;
        }
        setCriteriaByPlan(criteriaMap);
      } catch (error) {
        console.error('Error loading trading plans:', error);
        Alert.alert('Error', 'Failed to load trading plans.');
      }
    };

    loadPlansAndCriteria();
  }, []);

  const handleAddPlan = async () => {
    if (plans.length >= 3) {
      Alert.alert('Limit reached', 'You can only have up to 3 trading plans.');
      return;
    }

    const trimmed = planNameInput.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Please enter a name for the trading plan.');
      return;
    }

    try {
      const newPlan = await createTradingPlan(trimmed);
      const updatedPlans = [...plans, newPlan].slice(0, 3);
      setPlans(updatedPlans);
      setActivePlanId(newPlan.id);
      setPlanNameInput('');
      setCriteriaByPlan(prev => ({ ...prev, [newPlan.id]: [] }));
    } catch (error) {
      console.error('Error creating trading plan:', error);
      Alert.alert('Error', 'Failed to create trading plan.');
    }
  };

  const handleRenamePlan = async (planId) => {
    const trimmed = planNameInput.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Please enter a name for the trading plan.');
      return;
    }

    try {
      const updatedPlan = await renameTradingPlan(planId, trimmed);
      setPlans(prev => prev.map(p => (p.id === planId ? updatedPlan : p)));
      setPlanNameInput('');
      setIsRenamingPlanId(null);
    } catch (error) {
      console.error('Error renaming trading plan:', error);
      Alert.alert('Error', 'Failed to rename trading plan.');
    }
  };

  const confirmDeletePlan = (planId) => {
    const plan = plans.find(p => p.id === planId);
    Alert.alert(
      'Delete Trading Plan',
      `Are you sure you want to delete "${plan?.name}" and all its criteria?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeletePlan(planId),
        },
      ]
    );
  };

  const handleDeletePlan = async (planId) => {
    try {
      await deleteTradingPlan(planId);
      const remainingPlans = plans.filter(p => p.id !== planId);
      setPlans(remainingPlans);
      setCriteriaByPlan(prev => {
        const copy = { ...prev };
        delete copy[planId];
        return copy;
      });

      if (remainingPlans.length > 0) {
        setActivePlanId(remainingPlans[0].id);
      } else {
        setActivePlanId(null);
      }
    } catch (error) {
      console.error('Error deleting trading plan:', error);
      Alert.alert('Error', 'Failed to delete trading plan.');
    }
  };

  const activePlanCriteria = activePlanId ? criteriaByPlan[activePlanId] || [] : [];

  const handleAddCriterion = async () => {
    if (!activePlanId) {
      Alert.alert('No plan selected', 'Please select or create a trading plan first.');
      return;
    }

    const trimmed = newCriterionText.trim();
    if (!trimmed) {
      Alert.alert('Text required', 'Please enter the criterion text.');
      return;
    }

    try {
      const newCriterion = await addCriterionToPlan(activePlanId, trimmed);
      setCriteriaByPlan(prev => ({
        ...prev,
        [activePlanId]: [...(prev[activePlanId] || []), newCriterion],
      }));
      setNewCriterionText('');
    } catch (error) {
      console.error('Error adding criterion:', error);
      Alert.alert('Error', 'Failed to add criterion.');
    }
  };

  const handleToggleCriterion = async (criterionId, currentChecked) => {
    try {
      const updated = await toggleCriterionChecked(criterionId, !currentChecked);
      setCriteriaByPlan(prev => ({
        ...prev,
        [activePlanId]: (prev[activePlanId] || []).map(c =>
          c.id === criterionId ? updated : c
        ),
      }));
    } catch (error) {
      console.error('Error toggling criterion:', error);
      Alert.alert('Error', 'Failed to update criterion.');
    }
  };

  const startEditingCriterion = (criterion) => {
    setEditingCriterionId(criterion.id);
    setEditingCriterionText(criterion.text);
  };

  const handleSaveCriterionEdit = async () => {
    const trimmed = editingCriterionText.trim();
    if (!trimmed) {
      Alert.alert('Text required', 'Please enter the criterion text.');
      return;
    }

    try {
      const updated = await updateCriterionText(editingCriterionId, trimmed);
      setCriteriaByPlan(prev => ({
        ...prev,
        [activePlanId]: (prev[activePlanId] || []).map(c =>
          c.id === editingCriterionId ? updated : c
        ),
      }));
      setEditingCriterionId(null);
      setEditingCriterionText('');
    } catch (error) {
      console.error('Error updating criterion text:', error);
      Alert.alert('Error', 'Failed to update criterion.');
    }
  };

  const confirmDeleteCriterion = (criterionId) => {
    Alert.alert(
      'Delete Criterion',
      'Are you sure you want to delete this criterion?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeleteCriterion(criterionId),
        },
      ]
    );
  };

  const handleDeleteCriterion = async (criterionId) => {
    try {
      await deleteCriterion(criterionId);
      setCriteriaByPlan(prev => ({
        ...prev,
        [activePlanId]: (prev[activePlanId] || []).filter(c => c.id !== criterionId),
      }));
    } catch (error) {
      console.error('Error deleting criterion:', error);
      Alert.alert('Error', 'Failed to delete criterion.');
    }
  };

  const addMindsetEntry = () => {
    const newEntry = {
      id: Date.now(),
      phase: 'Waiting for a trade',
      beforeTrade: {
        expectations: '',
        groundExpectations: false,
        meetsCriteria: '',
        entryPrice: ''
      },
      afterTrade: {
        emotion: '',
        notes: ''
      }
    };
    setMindsetEntries([...mindsetEntries, newEntry]);
  };

  const updateMindsetEntry = (id, field, subfield, value) => {
    setMindsetEntries(entries =>
      entries.map(entry =>
        entry.id === id
          ? {
              ...entry,
              [field]: {
                ...entry[field],
                [subfield]: value
              }
            }
          : entry
      )
    );
  };

  const updateEntryPhase = (id, phase) => {
    setMindsetEntries(entries =>
      entries.map(entry =>
        entry.id === id
          ? { ...entry, phase }
          : entry
      )
    );
  };

  const deleteMindsetEntry = (id) => {
    setMindsetEntries(entries => entries.filter(entry => entry.id !== id));
  };

  const showTooltip = (key) => {
    const tooltip = tooltipData[key];
    if (tooltip) {
      setTooltipTitle(tooltip.title);
      setTooltipContent(tooltip.content);
      setTooltipVisible(true);
    }
  };

  const hideTooltip = () => {
    setTooltipVisible(false);
    setTooltipTitle('');
    setTooltipContent('');
  };

  // Calculate progress for active tab
  const getActiveProgress = () => {
    const total = activePlanCriteria.length;
    const completed = activePlanCriteria.filter(c => c.checked).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, percentage };
  };

  const progress = getActiveProgress();

  // Tooltip Label Component
  const TooltipLabel = ({ text, tooltipKey }) => (
    <TouchableOpacity 
      style={styles.tooltipLabelContainer}
      onPress={() => showTooltip(tooltipKey)}
      activeOpacity={0.7}
    >
      <Text style={styles.fieldLabel}>{text}</Text>
      <Ionicons name="information-circle-outline" size={16} color="#667eea" style={styles.tooltipIcon} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header with Gradient */}
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <Text style={styles.title}>Trading Criteria</Text>
        <Text style={styles.subtitle}>
          Key confirmations & mindset tool
        </Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Trading Plans Tabs & Controls */}
        <View style={styles.plansHeaderContainer}>
          <Text style={styles.sectionTitle}>Your Plans</Text>
        </View>
        
        <View style={styles.tabContainer}>
          {plans.map(plan => (
            <TouchableOpacity
              key={plan.id}
              style={[styles.tab, activePlanId === plan.id && styles.tabActive]}
              onPress={() => {
                setActivePlanId(plan.id);
                setIsRenamingPlanId(null);
                setPlanNameInput('');
              }}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={activePlanId === plan.id ? ['#667eea', '#764ba2'] : ['#ffffff', '#ffffff']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.tabGradient}
              >
                <View style={styles.tabContent}>
                  <Text
                    style={[styles.tabText, activePlanId === plan.id && styles.tabTextActive]}
                    numberOfLines={1}
                  >
                    {plan.name}
                  </Text>
                  
                  <View style={styles.tabActions}>
                    <TouchableOpacity
                      style={styles.tabActionButton}
                      onPress={() => {
                        setIsRenamingPlanId(plan.id);
                        setPlanNameInput(plan.name);
                      }}
                    >
                      <Ionicons
                        name="pencil"
                        size={14}
                        color={activePlanId === plan.id ? 'rgba(255,255,255,0.8)' : '#999'}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.tabActionButton}
                      onPress={() => confirmDeletePlan(plan.id)}
                    >
                      <Ionicons
                        name="trash"
                        size={14}
                        color={activePlanId === plan.id ? 'rgba(255,180,180,0.9)' : '#ff6b6b'}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))}
          
          {plans.length < 3 && (
             <TouchableOpacity
               style={styles.addPlanTab}
               onPress={() => {
                 setIsRenamingPlanId(null);
                 setPlanNameInput('');
                 // Focus input or show modal - for now we rely on the input below
                 // But let's make this button scroll to the input or just be a visual placeholder
                 // Actually, let's make it trigger the add mode if we had a modal.
                 // For now, we'll just let the user use the input field below.
               }}
             >
               <View style={styles.addPlanTabContent}>
                 <Ionicons name="add" size={24} color="#ccc" />
                 <Text style={styles.addPlanTabText}>New</Text>
               </View>
             </TouchableOpacity>
          )}
        </View>

        {/* Add / Rename Plan Input */}
        <View style={styles.planInputContainer}>
          <View style={styles.planInputWrapper}>
            <TextInput
              style={styles.planNameInput}
              value={planNameInput}
              onChangeText={setPlanNameInput}
              placeholder={isRenamingPlanId ? 'Rename plan...' : 'Create new plan...'}
              placeholderTextColor="#999"
            />
            <TouchableOpacity
              style={styles.planActionButton}
              onPress={() =>
                isRenamingPlanId ? handleRenamePlan(isRenamingPlanId) : handleAddPlan()
              }
            >
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.planActionGradient}
              >
                <Ionicons
                  name={isRenamingPlanId ? 'checkmark' : 'add'}
                  size={20}
                  color="#fff"
                />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Trading Checklist Bar */}
        <View style={styles.checklistCard}>
          <LinearGradient
            colors={['#ffffff', '#f8f9fa']}
            style={styles.checklistCardGradient}
          >
            <View style={styles.checklistHeader}>
              <View>
                <Text style={styles.checklistTitle}>
                  {plans.find(p => p.id === activePlanId)?.name || 'Trading Plan'}
                </Text>
                <Text style={styles.checklistSubtitle}>Confirmation Checklist</Text>
              </View>
              <View style={styles.progressBadge}>
                <Text style={styles.progressBadgeText}>{progress.completed}/{progress.total}</Text>
              </View>
            </View>
            
            <View style={styles.progressBarContainer}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressBar, { width: `${progress.percentage}%` }]}
              />
            </View>
            <Text style={styles.progressPercentage}>{progress.percentage}% Complete</Text>
          </LinearGradient>
        </View>

        {/* Trading Plan Criteria Checklist */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Criteria</Text>
          
          <View style={styles.criterionInputCard}>
            <TextInput
              style={styles.criterionInput}
              value={newCriterionText}
              onChangeText={setNewCriterionText}
              placeholder="Add a new rule..."
              placeholderTextColor="#999"
              multiline
            />
            <TouchableOpacity style={styles.criterionAddButton} onPress={handleAddCriterion}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.criterionAddGradient}
              >
                <Ionicons name="add" size={22} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {activePlanCriteria.map((criterion) => (
            <View
              key={criterion.id}
              style={[
                styles.criterionCard,
                criterion.checked && styles.criterionCardChecked,
              ]}
            >
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => handleToggleCriterion(criterion.id, criterion.checked)}
                activeOpacity={0.6}
              >
                <View style={[styles.customCheckbox, criterion.checked && styles.customCheckboxChecked]}>
                  {criterion.checked && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
              </TouchableOpacity>
              
              {editingCriterionId === criterion.id ? (
                <View style={styles.criterionEditContainer}>
                  <TextInput
                    style={styles.criterionEditInput}
                    value={editingCriterionText}
                    onChangeText={setEditingCriterionText}
                    multiline
                    autoFocus
                  />
                  <View style={styles.criterionEditActions}>
                    <TouchableOpacity
                      style={[styles.criterionEditActionBtn, { backgroundColor: '#e6fffa' }]}
                      onPress={handleSaveCriterionEdit}
                    >
                      <Ionicons name="checkmark" size={16} color="#28a745" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.criterionEditActionBtn, { backgroundColor: '#fff5f5' }]}
                      onPress={() => {
                        setEditingCriterionId(null);
                        setEditingCriterionText('');
                      }}
                    >
                      <Ionicons name="close" size={16} color="#ff6b6b" />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.criterionContent}>
                  <TouchableOpacity 
                    style={styles.criterionTextContainer}
                    onPress={() => handleToggleCriterion(criterion.id, criterion.checked)}
                  >
                    <Text
                      style={[
                        styles.criterionText,
                        criterion.checked && styles.criterionTextChecked,
                      ]}
                    >
                      {criterion.text}
                    </Text>
                  </TouchableOpacity>
                  
                  <View style={styles.criterionRowActions}>
                    <TouchableOpacity
                      style={styles.criterionIconBtn}
                      onPress={() => startEditingCriterion(criterion)}
                    >
                      <Ionicons name="pencil-outline" size={16} color="#667eea" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.criterionIconBtn}
                      onPress={() => confirmDeleteCriterion(criterion.id)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#ff6b6b" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))}
          
          {activePlanCriteria.length === 0 && (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="list-outline" size={48} color="#e1e8ed" />
              <Text style={styles.emptyStateText}>No criteria yet. Add your first rule above!</Text>
            </View>
          )}
        </View>

        {/* Trading Mindset Section */}
        <View style={styles.mindsetSection}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.mindsetHeader}
          >
            <Text style={styles.mindsetTitle}>TRADING MINDSET</Text>
            <Text style={styles.mindsetSubtitle}>BULLETPROOF YOUR MINDSET TOOL</Text>
          </LinearGradient>

          <View style={styles.mindsetContent}>
            <Text style={styles.mindsetDescription}>
              Use this tool when: Waiting for a trade • Just about to take a trade • Entered a trade • Moving stop loss • Moving take profit
            </Text>

            {/* Add New Entry Button */}
            <TouchableOpacity style={styles.addEntryButton} onPress={addMindsetEntry}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.addEntryGradient}
              >
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.addEntryText}>Add Mindset Entry</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Mindset Entries Table */}
            {mindsetEntries.map((entry, index) => (
              <View key={entry.id} style={styles.mindsetEntry}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryNumber}>Entry #{index + 1}</Text>
                  <TouchableOpacity 
                    onPress={() => deleteMindsetEntry(entry.id)}
                    style={styles.deleteButton}
                  >
                    <Ionicons name="trash-outline" size={16} color="#ff6b6b" />
                  </TouchableOpacity>
                </View>

                {/* Phase Selector */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Trading Phase</Text>
                  <View style={styles.phaseSelector}>
                    {mindsetPhases.map(phase => (
                      <TouchableOpacity
                        key={phase}
                        style={[
                          styles.phaseOption,
                          entry.phase === phase && styles.phaseOptionSelected
                        ]}
                        onPress={() => updateEntryPhase(entry.id, phase)}
                      >
                        <Text style={[
                          styles.phaseOptionText,
                          entry.phase === phase && styles.phaseOptionTextSelected
                        ]}>
                          {phase}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Before Trade Section */}
                <View style={styles.tradeSection}>
                  <Text style={styles.sectionHeader}>Before-Trade</Text>
                  
                  <View style={styles.fieldGroup}>
                    <TooltipLabel text="What are my expectations?" tooltipKey="expectations" />
                    <TextInput
                      style={styles.textInput}
                      value={entry.beforeTrade.expectations}
                      onChangeText={(text) => updateMindsetEntry(entry.id, 'beforeTrade', 'expectations', text)}
                      placeholder="Describe your trade expectations..."
                      multiline
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <TouchableOpacity
                      style={styles.checkboxField}
                      onPress={() => updateMindsetEntry(entry.id, 'beforeTrade', 'groundExpectations', !entry.beforeTrade.groundExpectations)}
                    >
                      <Ionicons
                        name={entry.beforeTrade.groundExpectations ? 'checkbox' : 'checkbox-outline'}
                        size={20}
                        color={entry.beforeTrade.groundExpectations ? '#667eea' : '#ccc'}
                      />
                      <TouchableOpacity 
                        style={styles.checkboxLabelContainer}
                        onPress={() => showTooltip('groundExpectations')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.checkboxLabel}>Ground Expectations</Text>
                        <Ionicons name="information-circle-outline" size={14} color="#667eea" style={styles.tooltipIconSmall} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.fieldGroup}>
                    <TooltipLabel text="Does the trade meet my TP criteria?" tooltipKey="tpCriteria" />
                    <View style={styles.dropdownContainer}>
                      <TouchableOpacity
                        style={[styles.dropdown, entry.beforeTrade.meetsCriteria === 'Yes' && styles.dropdownSelected]}
                        onPress={() => updateMindsetEntry(entry.id, 'beforeTrade', 'meetsCriteria', 'Yes')}
                      >
                        <Text style={[styles.dropdownText, entry.beforeTrade.meetsCriteria === 'Yes' && styles.dropdownTextSelected]}>Yes</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.dropdown, entry.beforeTrade.meetsCriteria === 'No' && styles.dropdownSelected]}
                        onPress={() => updateMindsetEntry(entry.id, 'beforeTrade', 'meetsCriteria', 'No')}
                      >
                        <Text style={[styles.dropdownText, entry.beforeTrade.meetsCriteria === 'No' && styles.dropdownTextSelected]}>No</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Entry Price (Optional)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={entry.beforeTrade.entryPrice}
                      onChangeText={(text) => updateMindsetEntry(entry.id, 'beforeTrade', 'entryPrice', text)}
                      placeholder="1.2345"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* After Trade Section */}
                <View style={styles.tradeSection}>
                  <Text style={styles.sectionHeader}>After-Trade</Text>
                  
                  <View style={styles.fieldGroup}>
                    <TooltipLabel text="Emotion (+/-)" tooltipKey="emotion" />
                    <View style={styles.emotionSelector}>
                      {emotionOptions.map(emotion => (
                        <TouchableOpacity
                          key={emotion.value}
                          style={[
                            styles.emotionOption,
                            entry.afterTrade.emotion === emotion.value && styles.emotionOptionSelected
                          ]}
                          onPress={() => updateMindsetEntry(entry.id, 'afterTrade', 'emotion', emotion.value)}
                        >
                          <Text style={styles.emotionEmoji}>{emotion.label.split(' ')[0]}</Text>
                          <Text style={styles.emotionScore}>{emotion.score}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <TooltipLabel text="Notes & Refinements" tooltipKey="notes" />
                    <TextInput
                      style={[styles.textInput, styles.textAreaLarge]}
                      value={entry.afterTrade.notes}
                      onChangeText={(text) => updateMindsetEntry(entry.id, 'afterTrade', 'notes', text)}
                      placeholder="What did you learn? How can you improve?"
                      multiline
                      numberOfLines={4}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Ideal Mindset Quote */}
        <View style={styles.mindsetQuote}>
          <LinearGradient
            colors={['#f093fb', '#f5576c']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.quoteContainer}
          >
            <Ionicons name="bulb" size={24} color="#fff" style={styles.quoteIcon} />
            <Text style={styles.quoteTitle}>The Ideal Mindset</Text>
            <Text style={styles.quoteText}>
              "I do not care which direction the market moves. I do not care whether this is a win or a loss.
              {'\n\n'}
              I am focused on consistently and persistently executing on my trading plan (my edge) which I know will be profitable over 1000 trades."
            </Text>
          </LinearGradient>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Tooltip Modal */}
      <Modal
        visible={tooltipVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={hideTooltip}
      >
        <TouchableOpacity 
          style={styles.tooltipOverlay}
          activeOpacity={1}
          onPress={hideTooltip}
        >
          <TouchableOpacity style={styles.tooltipModal} activeOpacity={1}>
            <View style={styles.tooltipHeader}>
              <Text style={styles.tooltipModalTitle}>{tooltipTitle}</Text>
              <TouchableOpacity onPress={hideTooltip} style={styles.tooltipCloseButton}>
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={styles.tooltipContentContainer} 
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.tooltipContentInner}
            >
              <Text style={styles.tooltipModalContent}>{tooltipContent}</Text>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  // Tab Styles
  plansHeaderContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: 0.3,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  tab: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    height: 80,
  },
  tabActive: {
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    transform: [{ scale: 1.02 }],
  },
  tabGradient: {
    flex: 1,
    padding: 12,
  },
  tabContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6c757d',
    marginBottom: 4,
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '800',
  },
  tabActions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 12,
  },
  tabActionButton: {
    padding: 4,
  },
  addPlanTab: {
    width: 50,
    borderRadius: 16,
    backgroundColor: '#f1f3f5',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPlanTabContent: {
    alignItems: 'center',
  },
  addPlanTabText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#adb5bd',
    marginTop: 2,
  },

  // Plan Input Styles
  planInputContainer: {
    marginBottom: 24,
  },
  planInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f3f5',
  },
  planNameInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#2c3e50',
    fontWeight: '500',
  },
  planActionButton: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  planActionGradient: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Enhanced Checklist Card Styles
  checklistCard: {
    borderRadius: 24,
    marginBottom: 32,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    backgroundColor: '#fff',
  },
  checklistCardGradient: {
    padding: 24,
    borderRadius: 24,
  },
  checklistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  checklistTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  checklistSubtitle: {
    fontSize: 14,
    color: '#868e96',
    fontWeight: '500',
  },
  progressBadge: {
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  progressBadgeText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '800',
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: '#f1f3f5',
    borderRadius: 6,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: 12,
    borderRadius: 6,
  },
  progressPercentage: {
    fontSize: 15,
    fontWeight: '700',
    color: '#667eea',
    textAlign: 'center',
  },

  // Enhanced Criteria Styles
  criterionInputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f3f5',
  },
  criterionInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#2c3e50',
    fontWeight: '500',
    maxHeight: 100,
  },
  criterionAddButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 4,
  },
  criterionAddGradient: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  criterionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f8f9fa',
  },
  criterionCardChecked: {
    backgroundColor: '#fcfdff',
    borderColor: '#eef2ff',
  },
  checkboxContainer: {
    marginRight: 16,
    marginTop: 2,
  },
  customCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e1e8ed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  customCheckboxChecked: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  criterionContent: {
    flex: 1,
  },
  criterionTextContainer: {
    marginBottom: 8,
  },
  criterionText: {
    fontSize: 16,
    color: '#2c3e50',
    lineHeight: 24,
    fontWeight: '600',
  },
  criterionTextChecked: {
    color: '#adb5bd',
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  criterionRowActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  criterionIconBtn: {
    padding: 4,
  },
  
  // Edit Mode Styles
  criterionEditContainer: {
    flex: 1,
  },
  criterionEditInput: {
    fontSize: 16,
    color: '#2c3e50',
    lineHeight: 24,
    fontWeight: '500',
    borderBottomWidth: 1,
    borderBottomColor: '#667eea',
    paddingBottom: 4,
    marginBottom: 12,
  },
  criterionEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  criterionEditActionBtn: {
    padding: 8,
    borderRadius: 8,
  },
  
  // Empty State
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    opacity: 0.7,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 15,
    color: '#adb5bd',
    fontWeight: '500',
  },

  // Enhanced Mindset Section Styles
  mindsetSection: {
    marginBottom: 24,
  },
  mindsetHeader: {
    padding: 28,
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  mindsetTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  mindsetSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  mindsetContent: {
    gap: 20,
  },
  mindsetDescription: {
    fontSize: 15,
    color: '#6c757d',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
    backgroundColor: 'rgba(102, 126, 234, 0.05)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.1)',
  },

  // Enhanced Add Entry Button
  addEntryButton: {
    marginBottom: 20,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addEntryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  addEntryText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginLeft: 10,
    letterSpacing: 0.3,
  },

  // Enhanced Mindset Entry Styles
  mindsetEntry: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#f8f9fa',
  },
  entryNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#667eea',
    letterSpacing: 0.5,
  },
  deleteButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 10,
  },

  // Enhanced Field Styles
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  tooltipLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  tooltipIcon: {
    marginLeft: 8,
  },
  tooltipIconSmall: {
    marginLeft: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e1e8ed',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#2c3e50',
    backgroundColor: '#fafbfc',
    fontWeight: '500',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  textAreaLarge: {
    height: 100,
    textAlignVertical: 'top',
  },

  // Enhanced Phase Selector
  phaseSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  phaseOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e1e8ed',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  phaseOptionSelected: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
    shadowColor: '#667eea',
    shadowOpacity: 0.3,
  },
  phaseOptionText: {
    fontSize: 13,
    color: '#6c757d',
    fontWeight: '600',
  },
  phaseOptionTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },

  // Enhanced Checkbox Field
  checkboxField: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  checkboxLabel: {
    fontSize: 15,
    color: '#2c3e50',
    fontWeight: '600',
  },

  // Enhanced Dropdown
  dropdownContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  dropdown: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#e1e8ed',
    borderRadius: 12,
    backgroundColor: '#fafbfc',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dropdownSelected: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
    shadowColor: '#667eea',
    shadowOpacity: 0.3,
  },
  dropdownText: {
    fontSize: 15,
    color: '#2c3e50',
    textAlign: 'center',
    fontWeight: '600',
  },
  dropdownTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },

  // Enhanced Trade Sections
  tradeSection: {
    marginBottom: 24,
    paddingTop: 20,
    borderTopWidth: 2,
    borderTopColor: '#f8f9fa',
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: '#667eea',
    marginBottom: 20,
    letterSpacing: 0.5,
  },

  // Enhanced Emotion Selector
  emotionSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  emotionOption: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e1e8ed',
    minWidth: 70,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  emotionOptionSelected: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
    shadowColor: '#667eea',
    shadowOpacity: 0.3,
  },
  emotionEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  emotionScore: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6c757d',
  },

  // Enhanced Quote Styles
  mindsetQuote: {
    marginBottom: 24,
    shadowColor: '#f093fb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  quoteContainer: {
    padding: 28,
    borderRadius: 20,
    alignItems: 'center',
  },
  quoteIcon: {
    marginBottom: 16,
  },
  quoteTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  quoteText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 26,
    fontStyle: 'italic',
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  bottomPadding: {
    height: 40,
  },

  // Tooltip Modal Styles
  tooltipOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  tooltipModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '92%',
    height: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  tooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  tooltipModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    flex: 1,
    paddingRight: 12,
  },
  tooltipCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  tooltipContentContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  tooltipContentInner: {
    padding: 20,
    paddingTop: 16,
  },
  tooltipModalContent: {
    fontSize: 16,
    lineHeight: 26,
    color: '#333',
    textAlign: 'left',
  },
});

export default CriteriaScreen;