import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CopilotResponse {
  answer: string;
  suggestedPrompts?: string[];
  actionLink?: {
    type: 'nav' | 'jira' | 'url';
    target: string;
    label: string;
  };
  dataContext?: any;
}

export interface StreamChunk {
  token?: string;
  done?: boolean;
  error?: string;
  actionLink?: CopilotResponse['actionLink'];
  suggestedPrompts?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class CopilotService {
  private apiUrl = 'http://localhost:3000/copilot';

  constructor(private http: HttpClient) {}

  /** Non-streaming (legacy, kept for fallback) */
  query(prompt: string, userRole: string = 'manager'): Observable<CopilotResponse> {
    return this.http.post<CopilotResponse>(`${this.apiUrl}/query`, { prompt, userRole });
  }

  /**
   * Streaming query — calls the /stream SSE endpoint.
   * Returns an Observable that emits StreamChunk objects one by one.
   * Completes when a chunk with `done: true` is received.
   */
  queryStream(
    prompt: string,
    userRole: string = 'manager',
    onToken: (token: string) => void,
    onDone: (meta: { actionLink?: CopilotResponse['actionLink']; suggestedPrompts?: string[] }) => void,
    onError: (msg: string) => void,
  ): void {
    fetch(`${this.apiUrl}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, userRole }),
    })
      .then(async (response) => {
        if (!response.ok) {
          onError(`HTTP ${response.status}`);
          return;
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;

            const jsonStr = trimmed.slice(5).trim();
            if (jsonStr === '[DONE]') continue;

            try {
              const chunk: StreamChunk = JSON.parse(jsonStr);
              if (chunk.error) {
                onError(chunk.error);
                return;
              }
              if (chunk.token) {
                onToken(chunk.token);
              }
              if (chunk.done) {
                onDone({
                  actionLink: chunk.actionLink ?? undefined,
                  suggestedPrompts: chunk.suggestedPrompts,
                });
                return;
              }
            } catch {
              // Incomplete JSON chunk, skip
            }
          }
        }
      })
      .catch((err) => {
        onError(err?.message || 'Network error');
      });
  }
}
