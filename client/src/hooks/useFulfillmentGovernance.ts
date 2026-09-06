import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../services/api';
import {
  FulfillmentEvaluationResponseDTO,
  FulfillmentPlanDTO,
  ManualOverrideItemDTO,
  SavedQuoteDTO,
  WarehouseDTO,
} from '../types/api';

export function useFulfillmentGovernance(activeQuote: SavedQuoteDTO | null) {
  const [warehouses, setWarehouses] = useState<WarehouseDTO[]>([]);
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState<boolean>(false);
  const [warehousesError, setWarehousesError] = useState<string | null>(null);

  const [evaluation, setEvaluation] = useState<FulfillmentEvaluationResponseDTO | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);

  const [manualOverrides, setManualOverrides] = useState<ManualOverrideItemDTO[]>([]);

  const [persistedPlan, setPersistedPlan] = useState<FulfillmentPlanDTO | null>(null);
  const [isAllocating, setIsAllocating] = useState<boolean>(false);
  const [allocationError, setAllocationError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load authoritative warehouse stock data from backend
  const loadWarehouses = useCallback(async () => {
    setIsLoadingWarehouses(true);
    setWarehousesError(null);
    try {
      const data = await apiClient.getWarehouses();
      setWarehouses(data);
    } catch (err: any) {
      setWarehousesError(err.message || 'Failed to load warehouses.');
    } finally {
      setIsLoadingWarehouses(false);
    }
  }, []);

  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  // Load existing persisted plan if quote already allocated
  const loadPersistedPlan = useCallback(async (quoteId: string) => {
    try {
      const plan = await apiClient.getFulfillmentByQuoteId(quoteId);
      setPersistedPlan(plan);
    } catch (err: any) {
      // Not allocated yet is expected (404)
      setPersistedPlan(null);
    }
  }, []);

  // Evaluate quote fulfillment when active quote changes
  useEffect(() => {
    if (!activeQuote) {
      setEvaluation(null);
      setPersistedPlan(null);
      setManualOverrides([]);
      return;
    }

    // Try loading existing persisted plan first
    loadPersistedPlan(activeQuote.id);

    // If quote is in APPROVED or AUTO_APPROVED status, evaluate simulation
    if (activeQuote.status === 'APPROVED' || activeQuote.status === 'AUTO_APPROVED') {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsEvaluating(true);
      setEvaluationError(null);

      apiClient
        .evaluateFulfillment(activeQuote.id, controller.signal)
        .then((res) => {
          setEvaluation(res);
          setIsEvaluating(false);
        })
        .catch((err: any) => {
          if (err.name === 'AbortError') return;
          setEvaluationError(err.message || 'Fulfillment evaluation failed.');
          setIsEvaluating(false);
        });
    } else {
      setEvaluation(null);
    }
  }, [activeQuote, loadPersistedPlan]);

  // Handler to set/toggle a manual override for a line item
  const handleSetOverride = useCallback((quoteLineId: string, warehouseId: string) => {
    setManualOverrides((prev) => {
      const filtered = prev.filter((item) => item.quoteLineId !== quoteLineId);
      if (!warehouseId) {
        return filtered;
      }
      return [...filtered, { quoteLineId, warehouseId }];
    });
  }, []);

  const handleClearOverrides = useCallback(() => {
    setManualOverrides([]);
  }, []);

  // Execute Allocation (Operations Lead / Sales Manager)
  const allocateFulfillment = async () => {
    if (!activeQuote) return;
    setIsAllocating(true);
    setAllocationError(null);

    try {
      const plan = await apiClient.allocateFulfillment(
        activeQuote.id,
        manualOverrides.length > 0 ? manualOverrides : undefined
      );

      setPersistedPlan(plan);
      // Refresh warehouse stock levels after inventory reservation
      await loadWarehouses();
    } catch (err: any) {
      setAllocationError(err.message || 'Allocation failed.');
    } finally {
      setIsAllocating(false);
    }
  };

  const [approvedDeals, setApprovedDeals] = useState<SavedQuoteDTO[]>([]);

  const loadApprovedDeals = useCallback(async () => {
    try {
      const deals = await apiClient.getApprovedDeals();
      setApprovedDeals(deals);
    } catch {
      // Silent catch
    }
  }, []);

  useEffect(() => {
    loadApprovedDeals();

    let isCancelled = false;
    let isRequestInFlight = false;

    const intervalId = setInterval(async () => {
      if (isCancelled || isRequestInFlight) return;
      isRequestInFlight = true;
      try {
        const deals = await apiClient.getApprovedDeals();
        if (!isCancelled && deals) {
          setApprovedDeals(deals);
        }
      } catch {
        // Silent catch during status polling
      } finally {
        isRequestInFlight = false;
      }
    }, 3000);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [loadApprovedDeals]);

  return {
    warehouses,
    isLoadingWarehouses,
    warehousesError,
    evaluation,
    isEvaluating,
    evaluationError,
    manualOverrides,
    setOverride: handleSetOverride,
    clearOverrides: handleClearOverrides,
    persistedPlan,
    isAllocating,
    allocationError,
    allocateFulfillment,
    refreshWarehouses: loadWarehouses,
    approvedDeals,
    refreshApprovedDeals: loadApprovedDeals,
  };
}
