import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket;
  private readonly url = 'http://localhost:3000'; // URL of NestJS backend

  // Historique des notifications en temps réel
  notificationHistory: Array<{ timestamp: Date; key: string; message: string }> = [];

  constructor() {
    this.socket = io(this.url, {
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
  }

  addNotification(key: string, message: string) {
    this.notificationHistory.unshift({
      timestamp: new Date(),
      key,
      message
    });
  }

  clearHistory() {
    this.notificationHistory = [];
  }

  /**
   * Listen to Jira tickets updates from the backend
   */
  onJiraTicketsUpdated(): Observable<{ team: string, tickets: any }> {
    return new Observable(observer => {
      this.socket.on('jira_tickets_updated', (data) => {
        observer.next(data);
      });
      // Cleanup on unsubscribe
      return () => this.socket.off('jira_tickets_updated');
    });
  }
}
