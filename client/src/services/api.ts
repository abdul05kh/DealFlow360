import {
  APIErrorResponse,
  AuthResponseDTO,
  AuthUserDTO,
  BillingSummaryDTO,
  CreateCustomerPayloadDTO,
  CreateCustomerTierPayloadDTO,
  CreateOperatorPayloadDTO,
  CreateProductCategoryPayloadDTO,
  CreateProductPayloadDTO,
  CreditNoteDTO,
  CustomerDTO,
  CustomerNegotiationDTO,
  CustomerQuoteDTO,
  CustomerTierDTO,
  DemoRole,
  EvaluateQuotePayloadDTO,
  FullQuoteEvaluationDTO,
  FulfillmentEvaluationResponseDTO,
  FulfillmentPlanDTO,
  InvoiceDTO,
  LoginPayloadDTO,
  ManualOverrideItemDTO,
  OperatorCustomerRequestDTO,
  OperatorDTO,
  ProductCategoryDTO,
  ProductDTO,
  RespondNegotiationPayloadDTO,
  SavedQuoteDTO,
  SignupPayloadDTO,
  SubmitNegotiationPayloadDTO,
  SubscriptionDTO,
  UpdateCustomerPayloadDTO,
  UpdateCustomerTierPayloadDTO,
  UpdateOperatorPayloadDTO,
  UpdateProductCategoryPayloadDTO,
  UpdateProductPayloadDTO,
  WarehouseDTO,
} from '../types/api';

const API_BASE = '/api/v1';

export class APIClient {
  private role: DemoRole = 'SALES_REP';
  private userId: string = 'rep_1';
  private token: string | null = typeof window !== 'undefined' ? localStorage.getItem('df360_token') : null;
  private currentUser: AuthUserDTO | null = null;

  setIdentity(role: DemoRole, userId?: string) {
    this.role = role;
    this.userId =
      userId ||
      (role === 'OPERATIONS_MANAGER'
        ? 'ops_1'
        : role === 'SALES_MANAGER'
        ? 'mgr_1'
        : role === 'ADMIN'
        ? 'admin_1'
        : role === 'CUSTOMER'
        ? 'cust_user_1'
        : 'rep_1');
  }

  getIdentity(): { role: DemoRole; userId: string } {
    if (this.currentUser) {
      return { role: this.currentUser.role, userId: this.currentUser.id };
    }
    return { role: this.role, userId: this.userId };
  }

  getCurrentAuthUser(): AuthUserDTO | null {
    return this.currentUser;
  }

  getToken(): string | null {
    return this.token;
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('df360_token', token);
      } else {
        localStorage.removeItem('df360_token');
      }
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Demo-Role': this.currentUser ? this.currentUser.role : this.role,
      'X-Demo-User-Id': this.currentUser ? this.currentUser.id : this.userId,
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async login(payload: LoginPayloadDTO): Promise<AuthResponseDTO> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await this.handleResponse<AuthResponseDTO>(res);
    this.setToken(data.token);
    this.currentUser = data.user;
    this.setIdentity(data.user.role, data.user.id);
    return data;
  }

  async loginWithFirebaseToken(idToken: string): Promise<AuthResponseDTO> {
    const res = await fetch(`${API_BASE}/auth/firebase-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const data = await this.handleResponse<AuthResponseDTO>(res);
    this.setToken(data.token);
    this.currentUser = data.user;
    this.setIdentity(data.user.role, data.user.id);
    return data;
  }

  async signup(payload: SignupPayloadDTO): Promise<AuthResponseDTO> {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await this.handleResponse<AuthResponseDTO>(res);
    this.setToken(data.token);
    this.currentUser = data.user;
    this.setIdentity(data.user.role, data.user.id);
    return data;
  }

  async getCurrentUser(): Promise<AuthUserDTO | null> {
    if (!this.token) return null;
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: this.getHeaders(),
      });
      const data = await this.handleResponse<{ user: AuthUserDTO }>(res);
      this.currentUser = data.user;
      this.setIdentity(data.user.role, data.user.id);
      return data.user;
    } catch {
      this.logout();
      return null;
    }
  }

  logout() {
    this.setToken(null);
    this.currentUser = null;
  }

  private onUnauthorized: (() => void) | null = null;

  setOnUnauthorized(cb: (() => void) | null) {
    this.onUnauthorized = cb;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      if (response.status === 401 && this.onUnauthorized) {
        this.onUnauthorized();
      }
      let errorData: APIErrorResponse;
      try {
        errorData = await response.json();
      } catch {
        errorData = {
          error: `HTTP_${response.status}`,
          message: `Request failed with status ${response.status}`,
        };
      }
      throw new Error(errorData.message || `API Error: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  async getCustomers(includeInactive = false): Promise<CustomerDTO[]> {
    const url = includeInactive ? `${API_BASE}/customers?includeInactive=true` : `${API_BASE}/customers`;
    const res = await fetch(url, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<CustomerDTO[]>(res);
  }

  async createCustomer(payload: CreateCustomerPayloadDTO): Promise<CustomerDTO> {
    const res = await fetch(`${API_BASE}/customers`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<CustomerDTO>(res);
  }

  async updateCustomer(id: string, payload: UpdateCustomerPayloadDTO): Promise<CustomerDTO> {
    const res = await fetch(`${API_BASE}/customers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<CustomerDTO>(res);
  }

  async getProducts(includeInactive = false, search?: string, limit?: number): Promise<ProductDTO[]> {
    const params = new URLSearchParams();
    if (includeInactive) params.append('includeInactive', 'true');
    if (search && search.trim().length > 0) params.append('search', search.trim());
    if (limit && limit > 0) params.append('limit', limit.toString());

    const queryString = params.toString();
    const url = `${API_BASE}/products${queryString ? `?${queryString}` : ''}`;
    const res = await fetch(url, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<ProductDTO[]>(res);
  }

  async createProduct(payload: CreateProductPayloadDTO): Promise<ProductDTO> {
    const res = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<ProductDTO>(res);
  }

  async updateProduct(id: string, payload: UpdateProductPayloadDTO): Promise<ProductDTO> {
    const res = await fetch(`${API_BASE}/products/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<ProductDTO>(res);
  }

  async getCustomerTiers(includeInactive = false): Promise<CustomerTierDTO[]> {
    const url = includeInactive ? `${API_BASE}/customer-tiers?includeInactive=true` : `${API_BASE}/customer-tiers`;
    const res = await fetch(url, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<CustomerTierDTO[]>(res);
  }

  async createCustomerTier(payload: CreateCustomerTierPayloadDTO): Promise<CustomerTierDTO> {
    const res = await fetch(`${API_BASE}/customer-tiers`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<CustomerTierDTO>(res);
  }

  async updateCustomerTier(id: string, payload: UpdateCustomerTierPayloadDTO): Promise<CustomerTierDTO> {
    const res = await fetch(`${API_BASE}/customer-tiers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<CustomerTierDTO>(res);
  }

  async deactivateCustomerTier(id: string): Promise<CustomerTierDTO> {
    const res = await fetch(`${API_BASE}/customer-tiers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse<CustomerTierDTO>(res);
  }

  async getProductCategories(): Promise<ProductCategoryDTO[]> {
    const res = await fetch(`${API_BASE}/product-categories`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<ProductCategoryDTO[]>(res);
  }

  async createProductCategory(payload: CreateProductCategoryPayloadDTO): Promise<ProductCategoryDTO> {
    const res = await fetch(`${API_BASE}/product-categories`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<ProductCategoryDTO>(res);
  }

  async updateProductCategory(id: string, payload: UpdateProductCategoryPayloadDTO): Promise<ProductCategoryDTO> {
    const res = await fetch(`${API_BASE}/product-categories/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<ProductCategoryDTO>(res);
  }

  async evaluateQuote(
    payload: EvaluateQuotePayloadDTO,
    signal?: AbortSignal
  ): Promise<FullQuoteEvaluationDTO> {
    const res = await fetch(`${API_BASE}/quotes/evaluate`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
      signal,
    });
    return this.handleResponse<FullQuoteEvaluationDTO>(res);
  }

  async createQuote(payload: EvaluateQuotePayloadDTO): Promise<SavedQuoteDTO> {
    const res = await fetch(`${API_BASE}/quotes`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<SavedQuoteDTO>(res);
  }

  async approveQuote(quoteId: string, reason?: string): Promise<SavedQuoteDTO> {
    const res = await fetch(`${API_BASE}/quotes/${encodeURIComponent(quoteId)}/approve`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ reason }),
    });
    return this.handleResponse<SavedQuoteDTO>(res);
  }

  async rejectQuote(quoteId: string, reason?: string): Promise<SavedQuoteDTO> {
    const res = await fetch(`${API_BASE}/quotes/${encodeURIComponent(quoteId)}/reject`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ reason }),
    });
    return this.handleResponse<SavedQuoteDTO>(res);
  }

  async getQuoteById(quoteId: string): Promise<SavedQuoteDTO> {
    const res = await fetch(`${API_BASE}/quotes/${encodeURIComponent(quoteId)}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<SavedQuoteDTO>(res);
  }

  /** Flow B Fulfillment Endpoints */

  async getWarehouses(): Promise<WarehouseDTO[]> {
    const res = await fetch(`${API_BASE}/warehouses`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<WarehouseDTO[]>(res);
  }

  async evaluateFulfillment(
    quoteId: string,
    signal?: AbortSignal
  ): Promise<FulfillmentEvaluationResponseDTO> {
    const res = await fetch(`${API_BASE}/fulfillment/evaluate`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ quoteId }),
      signal,
    });
    return this.handleResponse<FulfillmentEvaluationResponseDTO>(res);
  }

  async allocateFulfillment(
    quoteId: string,
    manualOverrides?: ManualOverrideItemDTO[]
  ): Promise<FulfillmentPlanDTO> {
    const payload: { quoteId: string; manualOverrides?: ManualOverrideItemDTO[] } = { quoteId };
    if (manualOverrides && manualOverrides.length > 0) {
      payload.manualOverrides = manualOverrides;
    }

    const res = await fetch(`${API_BASE}/fulfillment/allocate`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<FulfillmentPlanDTO>(res);
  }

  async getFulfillmentByQuoteId(quoteId: string): Promise<FulfillmentPlanDTO> {
    const res = await fetch(`${API_BASE}/fulfillment/quote/${encodeURIComponent(quoteId)}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<FulfillmentPlanDTO>(res);
  }

  /** P0-4 Customer Portal API Endpoints */

  async getCustomerQuotes(): Promise<CustomerQuoteDTO[]> {
    const res = await fetch(`${API_BASE}/customer/quotes`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<CustomerQuoteDTO[]>(res);
  }

  async getCustomerQuoteById(quoteId: string): Promise<CustomerQuoteDTO> {
    const res = await fetch(`${API_BASE}/customer/quotes/${encodeURIComponent(quoteId)}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<CustomerQuoteDTO>(res);
  }

  async submitNegotiation(
    quoteId: string,
    payload: SubmitNegotiationPayloadDTO
  ): Promise<CustomerQuoteDTO> {
    const res = await fetch(`${API_BASE}/customer/quotes/${encodeURIComponent(quoteId)}/negotiate`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<CustomerQuoteDTO>(res);
  }

  async respondToNegotiation(
    quoteId: string,
    negotiationId: string,
    payload: RespondNegotiationPayloadDTO
  ): Promise<SavedQuoteDTO> {
    const res = await fetch(
      `${API_BASE}/quotes/${encodeURIComponent(quoteId)}/negotiations/${encodeURIComponent(negotiationId)}/respond`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      }
    );
    return this.handleResponse<SavedQuoteDTO>(res);
  }

  /** Admin Operator Management Endpoints */

  async getOperators(): Promise<OperatorDTO[]> {
    const res = await fetch(`${API_BASE}/admin/operators`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<OperatorDTO[]>(res);
  }

  async createOperator(payload: CreateOperatorPayloadDTO): Promise<OperatorDTO> {
    const res = await fetch(`${API_BASE}/admin/operators`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<OperatorDTO>(res);
  }

  async updateOperator(id: string, payload: UpdateOperatorPayloadDTO): Promise<OperatorDTO> {
    const res = await fetch(`${API_BASE}/admin/operators/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<OperatorDTO>(res);
  }

  async deactivateOperator(id: string): Promise<OperatorDTO> {
    const res = await fetch(`${API_BASE}/admin/operators/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse<OperatorDTO>(res);
  }

  /** Operator Customer-Requests Work Queue */

  async getOperatorCustomerRequests(): Promise<OperatorCustomerRequestDTO[]> {
    const res = await fetch(`${API_BASE}/operator/customer-requests`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<OperatorCustomerRequestDTO[]>(res);
  }

  /** Increment 4 — Hybrid Billing Endpoints */

  async generateBillingForQuote(quoteId: string): Promise<BillingSummaryDTO> {
    const res = await fetch(`${API_BASE}/quotes/${encodeURIComponent(quoteId)}/billing`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({}),
    });
    return this.handleResponse<BillingSummaryDTO>(res);
  }

  async getBillingSummaryForQuote(quoteId: string): Promise<BillingSummaryDTO> {
    const res = await fetch(`${API_BASE}/quotes/${encodeURIComponent(quoteId)}/billing`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<BillingSummaryDTO>(res);
  }

  async getCustomerBilling(): Promise<{ invoices: InvoiceDTO[]; subscriptions: SubscriptionDTO[] }> {
    const res = await fetch(`${API_BASE}/customer/billing`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<{ invoices: InvoiceDTO[]; subscriptions: SubscriptionDTO[] }>(res);
  }

  async payInvoice(invoiceId: string): Promise<InvoiceDTO> {
    const res = await fetch(`${API_BASE}/invoices/${encodeURIComponent(invoiceId)}/pay`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse<InvoiceDTO>(res);
  }

  async cancelSubscription(subscriptionId: string): Promise<SubscriptionDTO> {
    const res = await fetch(`${API_BASE}/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({}),
    });
    return this.handleResponse<SubscriptionDTO>(res);
  }

  async issueCreditNote(invoiceId: string, amountMinor: number, reason: string): Promise<CreditNoteDTO> {
    const res = await fetch(`${API_BASE}/invoices/${encodeURIComponent(invoiceId)}/credit-note`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ amountMinor, reason }),
    });
    return this.handleResponse<CreditNoteDTO>(res);
  }
}

export const apiClient = new APIClient();
