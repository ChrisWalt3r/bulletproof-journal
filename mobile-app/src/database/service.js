// Cloud database service — all plans and criteria are stored in Supabase via the backend API
import { plansAPI } from '../services/api';

// ============ Trading Plans ============

export const getTradingPlans = async () => {
  try {
    const response = await plansAPI.getPlans();
    return response.data || [];
  } catch (error) {
    console.error('Error getting trading plans:', error);
    return [];
  }
};

export const createTradingPlan = async (name) => {
  try {
    const response = await plansAPI.createPlan(name);
    return response.data;
  } catch (error) {
    console.error('Error creating trading plan:', error);
    throw error;
  }
};

export const renameTradingPlan = async (planId, newName) => {
  try {
    const response = await plansAPI.renamePlan(planId, newName);
    return response.data;
  } catch (error) {
    console.error('Error renaming trading plan:', error);
    throw error;
  }
};

export const deleteTradingPlan = async (planId) => {
  try {
    await plansAPI.deletePlan(planId);
    return true;
  } catch (error) {
    console.error('Error deleting trading plan:', error);
    throw error;
  }
};

// ============ Criteria ============

export const getCriteriaForPlan = async (planId) => {
  try {
    const response = await plansAPI.getCriteria(planId);
    return response.data || [];
  } catch (error) {
    console.error('Error getting criteria for plan:', error);
    return [];
  }
};

export const addCriterionToPlan = async (planId, text) => {
  try {
    const response = await plansAPI.addCriterion(planId, text);
    return response.data;
  } catch (error) {
    console.error('Error adding criterion:', error);
    throw error;
  }
};

export const updateCriterionText = async (criterionId, newText, planId) => {
  try {
    const response = await plansAPI.updateCriterionText(planId, criterionId, newText);
    return response.data;
  } catch (error) {
    console.error('Error updating criterion text:', error);
    throw error;
  }
};

export const toggleCriterionChecked = async (criterionId, checked, planId) => {
  try {
    const response = await plansAPI.toggleCriterion(planId, criterionId, checked);
    return response.data;
  } catch (error) {
    console.error('Error toggling criterion:', error);
    throw error;
  }
};

export const deleteCriterion = async (criterionId, planId) => {
  try {
    await plansAPI.deleteCriterion(planId, criterionId);
    return true;
  } catch (error) {
    console.error('Error deleting criterion:', error);
    throw error;
  }
};

export const resetPlanCriteria = async (planId) => {
  try {
    const response = await plansAPI.resetCriteria(planId);
    return response.data || [];
  } catch (error) {
    console.error('Error resetting plan criteria:', error);
    throw error;
  }
};

export const reorderCriteria = async (planId, reorderedCriteria) => {
  try {
    const order = reorderedCriteria.map((c, index) => ({
      id: c.id,
      position: index
    }));
    const response = await plansAPI.reorderCriteria(planId, order);
    return response.data || [];
  } catch (error) {
    console.error('Error reordering criteria:', error);
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
