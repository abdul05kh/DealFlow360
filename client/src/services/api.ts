import {
  APIErrorResponse,
  AuthResponseDTO,
  AuthUserDTO,
  CustomerDTO,
  DemoRole,
  EvaluateQuotePayloadDTO,
  FullQuoteEvaluationDTO,
  FulfillmentEvaluationResponseDTO,
  FulfillmentPlanDTO,
  LoginPayloadDTO,
  ManualOverrideItemDTO,
  ProductDTO,
  SavedQuoteDTO,
  SignupPayloadDTO,
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

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
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

  async getCustomers(): Promise<CustomerDTO[]> {
    const res = await fetch(`${API_BASE}/customers`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<CustomerDTO[]>(res);
  }

  async getProducts(): Promise<ProductDTO[]> {
    const res = await fetch(`${API_BASE}/products`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse<ProductDTO[]>(res);
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
}

export const apiClient = new APIClient();
