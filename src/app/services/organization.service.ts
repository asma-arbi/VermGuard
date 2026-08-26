import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Organization {
  orgId: number | string;
  orgName: string;
  apiKey?: string;
  appKey?: string;
}

export interface SloItem {
  id: string;
  name: string;
  description: string;
  type: string;
  targetUrl?: string | null;
  targetUrls?: string[];
  targetThreshold: number | null;
  warningThreshold: number | null;
  timeframe: string | null;
  tags: string[];
}

export interface SloListResponse {
  orgName: string;
  slos: SloItem[];
  isFallback?: boolean;
  notice?: string;
}

export interface SloHistoryPoint {
  id: number;
  timestamp: number;
  startTime: string;
  endTime: string;
  durationMins: number;
  uptime: number;
  url?: string;
  status: 'BREACH' | 'WARNING';
  failureCause?: string;
  responseTimeThreshold?: number | null;
  isMuted?: boolean;
  datadogDowntimeWindow?: string;
  isExcluded?: boolean;
  reason?: string;
  excludedBy?: string;
}

export interface SloOverall {
  name: string;
  targetUrl?: string | null;
  targetUrls?: string[];
  uptime: number | null;
  rawUptime?: number | null;
  downtimeMins: number | null;
  rawDowntimeMins?: number | null;
  excludedDowntimeMins?: number | null;
  sliValue: number | null;
  errorBudgetRemaining: number | null;
}

export interface SloHistoryResponse {
  orgName: string;
  sloId: string;
  fromTs?: number;
  toTs?: number;
  totalMinutes?: number;
  targetThreshold?: number;
  overall: SloOverall;
  downtimeHistory: SloHistoryPoint[];
}

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  private apiUrl = 'http://localhost:3000/organizations';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const stored = localStorage.getItem('loggedUser');
    const role = stored ? JSON.parse(stored).role : 'soc';
    return new HttpHeaders({ 'x-role': role });
  }

  getOrganizations(): Observable<Organization[]> {
    return this.http.get<Organization[]>(this.apiUrl, { headers: this.getHeaders() });
  }

  getSlos(orgId: number | string): Observable<SloListResponse> {
    return this.http.get<SloListResponse>(`${this.apiUrl}/${orgId}/slos`, { headers: this.getHeaders() });
  }

  getSloHistory(
    orgId: number | string,
    sloId: string,
    fromTs?: number,
    toTs?: number,
  ): Observable<SloHistoryResponse> {
    let params = new HttpParams();
    if (fromTs) params = params.set('fromTs', fromTs.toString());
    if (toTs) params = params.set('toTs', toTs.toString());

    return this.http.get<SloHistoryResponse>(
      `${this.apiUrl}/${orgId}/slos/${sloId}/history`,
      { headers: this.getHeaders(), params }
    );
  }

  toggleExclusion(payload: {
    orgId: string;
    sloId: string;
    eventTimestamp: number;
    durationMins: number;
    reason?: string;
    excludedBy?: string;
  }): Observable<{ action: 'excluded' | 'included' }> {
    return this.http.post<{ action: 'excluded' | 'included' }>(
      `${this.apiUrl}/slos/events/toggle-exclusion`,
      payload,
      { headers: this.getHeaders() }
    );
  }
}
