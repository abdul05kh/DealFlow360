import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../services/api';
import {
  AuthUserDTO,
  CustomerDTO,
  DemoRole,
  FullQuoteEvaluationDTO,
  ProductDTO,
  QuoteItemInputDTO,
  SavedQuoteDTO,
} from '../types/api';

export function useQuoteGovernance() {
  const [currentRole, setCurrentRole] = useState<DemoRole>('SALES_REP');
  const [authUser, setAuthUser] = useState<AuthUserDTO | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [lineItems, setLineItems] = useState<QuoteItemInputDTO[]>([]);

  const [evaluation, setEvaluation] = useState<FullQuoteEvaluationDTO | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);

  const [savedQuote, setSavedQuote] = useState<SavedQuoteDTO | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [apiConnected, setApiConnected] = useState<boolean>(false);

  // Ref to track active AbortController for stale request cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  // Version counter to ensure strict request sequencing
  const requestVersionRef = useRef<number>(0);

  // Sync API identity when role changes
  const handleRoleChange = (newRole: DemoRole) => {
    setCurrentRole(newRole);
    if (!authUser) {
      apiClient.setIdentity(newRole);
    }
  };

  const handleAuthSuccess = (user: AuthUserDTO) => {
    setAuthUser(user);
    setCurrentRole(user.role);
  };

  const handleLogout = () => {
    apiClient.logout();
    setAuthUser(null);
    setCurrentRole('SALES_REP');
    apiClient.setIdentity('SALES_REP');
  };

  // Check stored JWT session on mount
  useEffect(() => {
    async function checkAuthSession() {
      if (apiClient.getToken()) {
        const user = await apiClient.getCurrentUser();
        if (user) {
          setAuthUser(user);
          setCurrentRole(user.role);
        }
      }
    }
    checkAuthSession();
  }, []);

  // Load initial master data
  useEffect(() => {
    let isMounted = true;
    async function loadMasterData() {
      try {
        const [custData, prodData] = await Promise.all([
          apiClient.getCustomers(),
          apiClient.getProducts(),
        ]);
        if (isMounted) {
          setCustomers(custData);
          setProducts(prodData);
          setApiConnected(true);

          // Default selection to first customer and first product if available
          if (custData.length > 0) {
            setSelectedCustomerId(custData[0].id);
          }
          if (prodData.length > 0) {
            setLineItems([
              {
                productId: prodData[0].id,
                quantity: 1,
                discountPercent: 10,
              },
            ]);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setEvaluationError(`Master data loading failed: ${err.message}`);
          setApiConnected(false);
        }
      }
    }
    loadMasterData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Live evaluation effect with 300ms debounce & AbortController stale request protection
  useEffect(() => {
    if (!selectedCustomerId || lineItems.length === 0) {
      setEvaluation(null);
      return;
    }

    // Cancel previous inflight request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const currentVersion = ++requestVersionRef.current;

    setIsEvaluating(true);
    setEvaluationError(null);

    const timer = setTimeout(async () => {
      try {
        const result = await apiClient.evaluateQuote(
          {
            customerId: selectedCustomerId,
            items: lineItems,
          },
          controller.signal
        );

        // Stale protection: only apply if this is still the latest request version
        if (currentVersion === requestVersionRef.current) {
          setEvaluation(result);
          setIsEvaluating(false);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // Ignored since request was aborted by newer input change
          return;
        }
        if (currentVersion === requestVersionRef.current) {
          setEvaluationError(err.message || 'Evaluation failed.');
          setIsEvaluating(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [selectedCustomerId, lineItems]);

  const addLineItem = useCallback(() => {
    if (products.length === 0) return;
    setLineItems((prev) => [
      ...prev,
      {
        productId: products[0].id,
        quantity: 1,
        discountPercent: 5,
      },
    ]);
  }, [products]);

  const updateLineItem = useCallback(
    (index: number, patch: Partial<QuoteItemInputDTO>) => {
      setLineItems((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], ...patch };
        return next;
      });
    },
    []
  );

  const removeLineItem = useCallback((index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Action: Save & Submit Quote (Sales Rep)
  const submitQuote = async () => {
    if (!selectedCustomerId || lineItems.length === 0) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const created = await apiClient.createQuote({
        customerId: selectedCustomerId,
        items: lineItems,
      });
      // Refresh quote details with audit history
      const fullQuote = await apiClient.getQuoteById(created.id);
      setSavedQuote(fullQuote);
    } catch (err: any) {
      setActionError(`Quote submission failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action: Approve Quote (Sales Manager)
  const approveQuote = async (reason?: string) => {
    if (!savedQuote) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await apiClient.approveQuote(savedQuote.id, reason);
      const updated = await apiClient.getQuoteById(savedQuote.id);
      setSavedQuote(updated);
    } catch (err: any) {
      setActionError(`Approval failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action: Reject Quote (Sales Manager)
  const rejectQuote = async (reason?: string) => {
    if (!savedQuote) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await apiClient.rejectQuote(savedQuote.id, reason);
      const updated = await apiClient.getQuoteById(savedQuote.id);
      setSavedQuote(updated);
    } catch (err: any) {
      setActionError(`Rejection failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Load quote preset values
  const applyPreset = useCallback(
    (presetCustomerId: string, presetItems: QuoteItemInputDTO[]) => {
      setSelectedCustomerId(presetCustomerId);
      setLineItems(presetItems);
      setSavedQuote(null);
      setActionError(null);
    },
    []
  );

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  return {
    currentRole,
    setRole: handleRoleChange,
    authUser,
    isAuthModalOpen,
    setIsAuthModalOpen,
    handleAuthSuccess,
    handleLogout,
    customers,
    products,
    selectedCustomerId,
    setSelectedCustomerId,
    selectedCustomer,
    lineItems,
    setLineItems,
    addLineItem,
    updateLineItem,
    removeLineItem,
    evaluation,
    isEvaluating,
    evaluationError,
    savedQuote,
    submitQuote,
    approveQuote,
    rejectQuote,
    isSubmitting,
    actionError,
    apiConnected,
    applyPreset,
  };
}
