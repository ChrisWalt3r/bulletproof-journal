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
  StatusBar,
  Dimensions,
  FlatList,
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
  resetPlanCriteria,
} from '../database/service';


const { width } = Dimensions.get('window');

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
    'Waiting',
    'Pre-Trade',
    'In Trade',
    'Stop Loss',
    'Take Profit'
  ];

  const emotionOptions = [
    { value: 'very-positive', label: '🤩 Great', score: '+2', color: '#00C851' },
    { value: 'positive', label: '🙂 Good', score: '+1', color: '#007E33' },
    { value: 'neutral', label: '😐 Okay', score: '0', color: '#FFbb33' },
    { value: 'negative', label: '😟 Bad', score: '-1', color: '#ff4444' },
    { value: 'very-negative', label: '😫 Awful', score: '-2', color: '#CC0000' },
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

  const handleResetCriteria = () => {
    Alert.alert(
      'Reset Checklist',
      'Are you sure you want to uncheck all rules for this plan?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedCriteria = await resetPlanCriteria(activePlanId);
              setCriteriaByPlan(prev => ({
                ...prev,
                [activePlanId]: updatedCriteria
              }));
            } catch (error) {
              console.error('Error resetting criteria:', error);
              Alert.alert('Error', 'Failed to reset checklist.');
            }
          }
        }
      ]
    );
  };



  const RenderCriteriaItem = ({ item }) => {
    const isChecked = item.checked;

    return (
      <View style={[styles.criterionCard, { marginHorizontal: 16 }]}>
        <TouchableOpacity
          style={[styles.checkbox, isChecked && styles.checkboxChecked]}
          onPress={() => handleToggleCriterion(item.id, isChecked)}
        >
          {isChecked && <Ionicons name="checkmark" size={16} color="#fff" />}
        </TouchableOpacity>

        <View style={styles.criterionContent}>
          {editingCriterionId === item.id ? (
            <View style={styles.editContainer}>
              <TextInput
                style={styles.editInput}
                value={editingCriterionText}
                onChangeText={setEditingCriterionText}
                autoFocus
                onBlur={handleSaveCriterionEdit}
                onSubmitEditing={handleSaveCriterionEdit}
              />
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => startEditingCriterion(item)}
            >
              <Text style={[styles.criterionText, isChecked && styles.criterionTextChecked]}>
                {item.text}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteCriterion(item.id)}
        >
          <Ionicons name="close-circle-outline" size={20} color="#ff6b6b" />
        </TouchableOpacity>
      </View>
    );
  };

  const addMindsetEntry = () => {
    const newEntry = {
      id: Date.now(),
      phase: 'Waiting',
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
      <Ionicons name="help-circle" size={16} color="#667eea" style={styles.tooltipIcon} />
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.header}
      >
        <Text style={styles.title}>Review & Criteria</Text>
        <Text style={styles.subtitle}>
          Master your edge and mindset
        </Text>
      </LinearGradient>

      <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
        {/* Trading Plans Section */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionTitle}>TRADING PLANS</Text>
        </View>

        {/* Modern Plan Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabsContainer}
        >
          {plans.map(plan => (
            <TouchableOpacity
              key={plan.id}
              style={[
                styles.planTab,
                activePlanId === plan.id && styles.planTabActive
              ]}
              onPress={() => {
                setActivePlanId(plan.id);
                setIsRenamingPlanId(null);
                setPlanNameInput('');
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.planTabText,
                  activePlanId === plan.id && styles.planTabTextActive
                ]}
              >
                {plan.name}
              </Text>

              {activePlanId === plan.id && (
                <View style={styles.activeTabIndicator} />
              )}
            </TouchableOpacity>
          ))}

          {plans.length < 3 && (
            <TouchableOpacity
              style={styles.addPlanButton}
              onPress={() => {
                setIsRenamingPlanId(null);
                setPlanNameInput('');
              }}
            >
              <Ionicons name="add" size={20} color="#667eea" />
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Plan Actions Bar */}
        <View style={styles.planActionsBar}>
          {activePlanId && (
            <>
              <TouchableOpacity
                style={styles.planActionButton}
                onPress={() => {
                  const plan = plans.find(p => p.id === activePlanId);
                  if (plan) {
                    setIsRenamingPlanId(plan.id);
                    setPlanNameInput(plan.name);
                  }
                }}
              >
                <Ionicons name="pencil" size={14} color="#666" />
                <Text style={styles.planActionText}>Rename</Text>
              </TouchableOpacity>

              <View style={styles.verticalDivider} />

              <TouchableOpacity
                style={styles.planActionButton}
                onPress={handleResetCriteria}
              >
                <Ionicons name="refresh" size={14} color="#667eea" />
                <Text style={[styles.planActionText, { color: '#667eea' }]}>Reset</Text>
              </TouchableOpacity>

              <View style={styles.verticalDivider} />

              <TouchableOpacity
                style={styles.planActionButton}
                onPress={() => confirmDeletePlan(activePlanId)}
              >
                <Ionicons name="trash-outline" size={14} color="#ff6b6b" />
                <Text style={[styles.planActionText, { color: '#ff6b6b' }]}>Delete Plan</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Add/Rename Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.modernInput}
            value={planNameInput}
            onChangeText={setPlanNameInput}
            placeholder={isRenamingPlanId ? 'Rename plan...' : 'Create new plan name...'}
            placeholderTextColor="#999"
          />
          {planNameInput.length > 0 && (
            <TouchableOpacity
              style={styles.inputActionButton}
              onPress={() =>
                isRenamingPlanId ? handleRenamePlan(isRenamingPlanId) : handleAddPlan()
              }
            >
              <Ionicons name="checkmark" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* Progress Card */}
        <LinearGradient
          colors={['#ffffff', '#f8f9fa']}
          style={styles.progressCard}
        >
          <View style={styles.progressHeader}>
            <View>
              <Text style={styles.progressTitle}>Execution Score</Text>
              <Text style={styles.progressSubtitle}>
                {plans.find(p => p.id === activePlanId)?.name || 'Select Plan'}
              </Text>
            </View>
            <View style={styles.percentageBadge}>
              <Text style={styles.percentageText}>{progress.percentage}%</Text>
            </View>
          </View>

          <View style={styles.track}>
            <LinearGradient
              colors={progress.percentage === 100 ? ['#00C851', '#007E33'] : ['#667eea', '#764ba2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.bar, { width: `${progress.percentage}%` }]}
            />
          </View>
          <Text style={styles.progressCount}>{progress.completed} of {progress.total} criteria met</Text>
        </LinearGradient>

        {/* Criteria Section Header */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionTitle}>ACCEPTANCE CRITERIA</Text>
        </View>

        <View style={styles.addCriterionCard}>
          <TextInput
            style={styles.addCriterionInput}
            value={newCriterionText}
            onChangeText={setNewCriterionText}
            placeholder="Add a new rule (e.g. 'RSI Divergence on 1H')"
            placeholderTextColor="#999"
            multiline
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAddCriterion}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {activePlanCriteria.length === 0 && (
          <View style={[styles.emptyContainer, { marginBottom: 20 }]}>
            <Ionicons name="list" size={40} color="#e0e0e0" />
            <Text style={styles.emptyText}>Your checklist is empty.</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderFooter = () => (
    <View style={{ paddingHorizontal: 16 }}>
      {/* Mindset Section */}
      <View style={styles.mindsetSection}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.mindsetHeader}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View>
            <Text style={styles.mindsetTitle}>PSYCHOLOGY LOG</Text>
            <Text style={styles.mindsetSubtitle}>Track your mental state</Text>
          </View>
          <TouchableOpacity style={styles.addMindsetButton} onPress={addMindsetEntry}>
            <Ionicons name="add" size={20} color="#667eea" />
            <Text style={styles.addMindsetText}>Add Log</Text>
          </TouchableOpacity>
        </LinearGradient>

        {mindsetEntries.length === 0 && (
          <View style={styles.emptyMindset}>
            <Text style={styles.emptyMindsetText}>
              "The key to trading success is emotional discipline. If intelligence were the key, there would be a lot more people making money trading."
            </Text>
            <Text style={styles.emptyMindsetAuthor}>- Victor Sperandeo</Text>
          </View>
        )}

        {mindsetEntries.map((entry, index) => (
          <View key={entry.id} style={styles.mindsetCard}>
            <View style={styles.mindsetCardHeader}>
              <View style={styles.entryBadge}>
                <Text style={styles.entryBadgeText}>Log #{index + 1}</Text>
              </View>
              <TouchableOpacity onPress={() => deleteMindsetEntry(entry.id)}>
                <Ionicons name="trash-outline" size={18} color="#ccc" />
              </TouchableOpacity>
            </View>

            <View style={styles.phaseContainer}>
              <Text style={styles.labelSmall}>CURRENT PHASE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.phaseScroll}>
                {mindsetPhases.map(phase => (
                  <TouchableOpacity
                    key={phase}
                    style={[
                      styles.phaseChip,
                      entry.phase === phase && styles.phaseChipActive
                    ]}
                    onPress={() => updateEntryPhase(entry.id, phase)}
                  >
                    <Text style={[
                      styles.phaseText,
                      entry.phase === phase && styles.phaseTextActive
                    ]}>{phase}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.gridContainer}>
              <View style={styles.gridItem}>
                <TooltipLabel text="Expectations" tooltipKey="expectations" />
                <TextInput
                  style={styles.inputSimple}
                  value={entry.beforeTrade.expectations}
                  onChangeText={(text) => updateMindsetEntry(entry.id, 'beforeTrade', 'expectations', text)}
                  placeholder="What do I expect?"
                  placeholderTextColor="#ccc"
                />
              </View>

              <View style={styles.gridItem}>
                <TooltipLabel text="Meets Rules?" tooltipKey="tpCriteria" />
                <View style={styles.yesNoContainer}>
                  {['Yes', 'No'].map(opt => (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.yesNoButton,
                        entry.beforeTrade.meetsCriteria === opt && (opt === 'Yes' ? styles.yesActive : styles.noActive)
                      ]}
                      onPress={() => updateMindsetEntry(entry.id, 'beforeTrade', 'meetsCriteria', opt)}
                    >
                      <Text style={[
                        styles.yesNoText,
                        entry.beforeTrade.meetsCriteria === opt && { color: '#fff' }
                      ]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.divider} />

            <View>
              <TooltipLabel text="Emotional State" tooltipKey="emotion" />
              <View style={styles.emotionRow}>
                {emotionOptions.map(emo => (
                  <TouchableOpacity
                    key={emo.value}
                    style={[
                      styles.emotionChip,
                      entry.afterTrade.emotion === emo.value && { backgroundColor: emo.color, borderColor: emo.color }
                    ]}
                    onPress={() => updateMindsetEntry(entry.id, 'afterTrade', 'emotion', emo.value)}
                  >
                    <Text style={styles.emotionEmoji}>{emo.label.split(' ')[0]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ marginTop: 15 }}>
              <TooltipLabel text="Notes" tooltipKey="notes" />
              <TextInput
                style={[styles.inputSimple, { height: 60 }]}
                value={entry.afterTrade.notes}
                onChangeText={(text) => updateMindsetEntry(entry.id, 'afterTrade', 'notes', text)}
                placeholder="Reflections..."
                placeholderTextColor="#ccc"
                multiline
              />
            </View>

          </View>
        ))}

      </View>

      <View style={{ height: 60 }} />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />

      <FlatList
        data={activePlanCriteria}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => <RenderCriteriaItem item={item} />}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      {/* Tooltip Modal */}
      <Modal
        visible={tooltipVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={hideTooltip}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={hideTooltip}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{tooltipTitle}</Text>
              <TouchableOpacity onPress={hideTooltip}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalBody}>{tooltipContent}</Text>
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7FA', // Clean grey-white background
  },
  header: {
    paddingTop: 60,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionHeaderContainer: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9ba0b8',
    letterSpacing: 1.2,
  },

  // Tabs
  tabsScroll: {
    marginBottom: 15,
    overflow: 'visible',
  },
  tabsContainer: {
    paddingVertical: 5,
    gap: 12,
  },
  planTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  planTabActive: {
    backgroundColor: '#fff',
    borderColor: '#667eea',
    shadowColor: '#667eea',
    shadowOpacity: 0.2,
  },
  planTabText: {
    color: '#8b939c',
    fontWeight: '600',
    fontSize: 14,
  },
  planTabTextActive: {
    color: '#667eea',
    fontWeight: '800',
  },
  addPlanButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.3)',
    borderStyle: 'dashed',
  },

  planActionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  planActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  planActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginLeft: 4,
  },
  verticalDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#ddd',
    marginHorizontal: 12,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  modernInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2,
  },
  inputActionButton: {
    marginLeft: 10,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },

  // Progress Card
  progressCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 5,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#333',
  },
  progressSubtitle: {
    fontSize: 13,
    color: '#8b939c',
    marginTop: 2,
    fontWeight: '500',
  },
  percentageBadge: {
    backgroundColor: 'rgba(50, 50, 50, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  percentageText: {
    fontWeight: '800',
    color: '#333',
  },
  track: {
    height: 10,
    backgroundColor: '#f1f2f6',
    borderRadius: 5,
    marginBottom: 10,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 5,
  },
  progressCount: {
    fontSize: 12,
    color: '#8b939c',
    fontWeight: '600',
    textAlign: 'right',
  },

  // Criteria Section
  criteriaSection: {
    marginBottom: 30,
  },
  addCriterionCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 6,
    paddingLeft: 16,
    alignItems: 'center',
    marginBottom: 16, // Spacing from list
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  addCriterionInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    paddingVertical: 8,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#764ba2',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  criterionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f0f0f5',
  },
  criterionCardChecked: {
    backgroundColor: '#fafbfc',
    borderColor: 'transparent',
  },
  checkboxArea: {
    marginRight: 15,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  criterionContent: {
    flex: 1,
  },
  criterionText: {
    fontSize: 15,
    color: '#2c3e50',
    fontWeight: '600',
    lineHeight: 22,
  },
  criterionTextChecked: {
    color: '#9ca3af',
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  criterionActions: {
    flexDirection: 'row',
    gap: 12,
    marginLeft: 10,
  },
  actionIcon: {
    padding: 4,
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editInput: {
    flex: 1,
    fontSize: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#667eea',
    paddingBottom: 4,
  },
  editActions: {
    flexDirection: 'row',
    marginLeft: 10,
    gap: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 30,
    opacity: 0.5,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },

  // Mindset Section
  mindsetSection: {
    marginBottom: 40,
  },
  mindsetHeader: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mindsetTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
  },
  mindsetSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  addMindsetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  addMindsetText: {
    color: '#667eea',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 4,
  },
  emptyMindset: {
    padding: 30,
    backgroundColor: '#fff',
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    borderStyle: 'dashed',
  },
  emptyMindsetText: {
    fontSize: 15,
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    lineHeight: 24,
  },
  emptyMindsetAuthor: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
    color: '#333',
  },
  mindsetCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f1f5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  mindsetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  entryBadge: {
    backgroundColor: '#F0F4FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  entryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#667eea',
  },
  labelSmall: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9ca3af',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  phaseContainer: {
    marginBottom: 15,
  },
  phaseScroll: {
    gap: 8,
  },
  phaseChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#eee',
  },
  phaseChipActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  phaseText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  phaseTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  gridContainer: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 15,
  },
  gridItem: {
    flex: 1,
  },
  inputSimple: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  yesNoContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 2,
  },
  yesNoButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  yesActive: {
    backgroundColor: '#00C851',
  },
  noActive: {
    backgroundColor: '#ff4444',
  },
  yesNoText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f1f5',
    marginVertical: 15,
  },
  emotionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  emotionChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emotionEmoji: {
    fontSize: 18,
  },

  // Tooltip Modal
  tooltipLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4b5563',
  },
  tooltipIcon: {
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#333',
  },
  modalBody: {
    fontSize: 15,
    color: '#555',
    lineHeight: 24,
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 3,
    backgroundColor: '#667eea',
    borderRadius: 2,
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
});

export default CriteriaScreen;