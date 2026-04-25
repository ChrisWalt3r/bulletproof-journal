import { plansAPI } from '../services/api.js';

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
  const response = await plansAPI.createPlan(name);
  return response.data;
};

export const renameTradingPlan = async (planId, newName) => {
  const response = await plansAPI.renamePlan(planId, newName);
  return response.data;
};

export const deleteTradingPlan = async (planId) => {
  await plansAPI.deletePlan(planId);
  return true;
};

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
  const response = await plansAPI.addCriterion(planId, text);
  return response.data;
};

export const updateCriterionText = async (criterionId, newText, planId) => {
  const response = await plansAPI.updateCriterionText(
    planId,
    criterionId,
    newText
  );
  return response.data;
};

export const toggleCriterionChecked = async (criterionId, checked, planId) => {
  const response = await plansAPI.toggleCriterion(planId, criterionId, checked);
  return response.data;
};

export const deleteCriterion = async (criterionId, planId) => {
  await plansAPI.deleteCriterion(planId, criterionId);
  return true;
};

export const resetPlanCriteria = async (planId) => {
  const response = await plansAPI.resetCriteria(planId);
  return response.data || [];
};

export const reorderCriteria = async (planId, reorderedCriteria) => {
  const order = reorderedCriteria.map((criterion, index) => ({
    id: criterion.id,
    position: index,
  }));
  const response = await plansAPI.reorderCriteria(planId, order);
  return response.data || [];
};
