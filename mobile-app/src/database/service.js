// Stub database service for features not yet migrated to cloud
// Trading Plans and Criteria will use AsyncStorage temporarily
import AsyncStorage from '@react-native-async-storage/async-storage';

const PLANS_KEY = 'trading_plans';
const CRITERIA_KEY = 'trading_criteria';

// ============ Trading Plans ============

export const getTradingPlans = async () => {
  try {
    const data = await AsyncStorage.getItem(PLANS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting trading plans:', error);
    return [];
  }
};

export const createTradingPlan = async (name) => {
  try {
    const plans = await getTradingPlans();
    const newPlan = {
      id: Date.now(),
      name,
      created_at: new Date().toISOString()
    };
    plans.push(newPlan);
    await AsyncStorage.setItem(PLANS_KEY, JSON.stringify(plans));
    return newPlan;
  } catch (error) {
    console.error('Error creating trading plan:', error);
    throw error;
  }
};

export const renameTradingPlan = async (planId, newName) => {
  try {
    const plans = await getTradingPlans();
    const index = plans.findIndex(p => p.id === planId);
    if (index !== -1) {
      plans[index].name = newName;
      await AsyncStorage.setItem(PLANS_KEY, JSON.stringify(plans));
      return plans[index];
    }
    throw new Error('Plan not found');
  } catch (error) {
    console.error('Error renaming trading plan:', error);
    throw error;
  }
};

export const deleteTradingPlan = async (planId) => {
  try {
    const plans = await getTradingPlans();
    const filtered = plans.filter(p => p.id !== planId);
    await AsyncStorage.setItem(PLANS_KEY, JSON.stringify(filtered));

    // Also delete criteria for this plan
    const criteria = await getAllCriteria();
    const filteredCriteria = criteria.filter(c => c.plan_id !== planId);
    await AsyncStorage.setItem(CRITERIA_KEY, JSON.stringify(filteredCriteria));

    return true;
  } catch (error) {
    console.error('Error deleting trading plan:', error);
    throw error;
  }
};

// ============ Criteria ============

const getAllCriteria = async () => {
  try {
    const data = await AsyncStorage.getItem(CRITERIA_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting criteria:', error);
    return [];
  }
};

export const getCriteriaForPlan = async (planId) => {
  try {
    const criteria = await getAllCriteria();
    return criteria.filter(c => c.plan_id === planId);
  } catch (error) {
    console.error('Error getting criteria for plan:', error);
    return [];
  }
};

export const addCriterionToPlan = async (planId, text) => {
  try {
    const criteria = await getAllCriteria();
    const newCriterion = {
      id: Date.now(),
      plan_id: planId,
      text,
      checked: false,
      created_at: new Date().toISOString()
    };
    criteria.push(newCriterion);
    await AsyncStorage.setItem(CRITERIA_KEY, JSON.stringify(criteria));
    return newCriterion;
  } catch (error) {
    console.error('Error adding criterion:', error);
    throw error;
  }
};

export const updateCriterionText = async (criterionId, newText) => {
  try {
    const criteria = await getAllCriteria();
    const index = criteria.findIndex(c => c.id === criterionId);
    if (index !== -1) {
      criteria[index].text = newText;
      await AsyncStorage.setItem(CRITERIA_KEY, JSON.stringify(criteria));
      return criteria[index];
    }
    throw new Error('Criterion not found');
  } catch (error) {
    console.error('Error updating criterion text:', error);
    throw error;
  }
};

export const toggleCriterionChecked = async (criterionId, checked) => {
  try {
    const criteria = await getAllCriteria();
    const index = criteria.findIndex(c => c.id === criterionId);
    if (index !== -1) {
      criteria[index].checked = checked;
      await AsyncStorage.setItem(CRITERIA_KEY, JSON.stringify(criteria));
      return criteria[index];
    }
    throw new Error('Criterion not found');
  } catch (error) {
    console.error('Error toggling criterion:', error);
    throw error;
  }
};

export const deleteCriterion = async (criterionId) => {
  try {
    const criteria = await getAllCriteria();
    const filtered = criteria.filter(c => c.id !== criterionId);
    await AsyncStorage.setItem(CRITERIA_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error deleting criterion:', error);
    throw error;
  }
};

// ============ Legacy stubs for compatibility ============
// These are no longer used but may be referenced somewhere

export const getAllEntries = async () => [];
export const getEntryById = async () => null;
export const createEntry = async () => ({});
export const updateEntry = async () => ({});
export const deleteEntry = async () => true;
export const getAllAccounts = async () => [];
export const getAccountById = async () => null;
export const createAccount = async () => ({});
export const updateAccount = async () => ({});
export const deleteAccount = async () => true;
export const getBalanceHistory = async () => [];
export const upsertMt5EntryFromBackend = async () => null;
export const saveImage = async (uri) => uri;
