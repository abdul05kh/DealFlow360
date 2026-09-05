import {
  APIErrorResponse,
  CustomerDTO,
  DemoRole,
  EvaluateQuotePayloadDTO,
  FullQuoteEvaluationDTO,
  ProductDTO,
  SavedQuoteDTO,
} from '../types/api';

const API_BASE = '/api/v1';

export class APIClient {
  private role: DemoRole = 'SALES_REP';
  private userId: string = 'rep_1';

  setIdentity(role: DemoRole, userId?: string) {
    this.role = role;
    this.userId = userId || (role === 'SALES_MANAGER' ? 'mgr_1' : 'rep_1');
  }

  getIdentity(): { role: DemoRole; userId: string } {
    return { role: this.role, userId: this.userId };
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Demo-Role': this.role,
      'X-Demo-User-Id': this.userId,
    };
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
}

export const apiClient = new APIClient();
