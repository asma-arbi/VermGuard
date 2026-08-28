import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

export interface NotificationItem {
  timestamp: Date;
  key: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket;
  private readonly url = 'http://localhost:3000'; // URL of NestJS backend
  private readonly STORAGE_KEY = 'vermguard_notifications_24h';
  private readonly TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000; // 24 hours in ms

  // Historique des notifications persistant 24h
  notificationHistory: NotificationItem[] = [];

  constructor() {
    this.socket = io(this.url, {
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    this.loadAndPurgeNotifications();

    // Vérification et nettoyage automatique toutes les minutes
    setInterval(() => {
      this.purgeOldNotifications();
    }, 60000);
  }

  /**
   * Charge les notifications enregistrées dans localStorage et supprime celles qui dépassent 24h
   */
  private loadAndPurgeNotifications() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const parsed: Array<{ timestamp: string; key: string; message: string }> = JSON.parse(raw);
        const now = Date.now();
        this.notificationHistory = parsed
          .filter(item => {
            const time = new Date(item.timestamp).getTime();
            return !isNaN(time) && (now - time) < this.TWENTY_FOUR_HOURS_MS;
          })
          .map(item => ({
            timestamp: new Date(item.timestamp),
            key: item.key,
            message: item.message,
          }));
      }
      if (this.notificationHistory.length === 0) {
        this.notificationHistory.push({
          timestamp: new Date(),
          key: 'SYSTEM',
          message: '⚡ VermGuard Operations Monitor Active — Live WebSocket Stream Connected.'
        });
        this.saveNotifications();
      }
    } catch (e) {
      console.warn('Failed to load notifications from localStorage', e);
      this.notificationHistory = [
        {
          timestamp: new Date(),
          key: 'SYSTEM',
          message: '⚡ VermGuard Operations Monitor Active — Live WebSocket Stream Connected.'
        }
      ];
      this.saveNotifications();
    }
  }

  /**
   * Nettoie les notifications de plus de 24h
   */
  public purgeOldNotifications() {
    const now = Date.now();
    const initialLength = this.notificationHistory.length;
    this.notificationHistory = this.notificationHistory.filter(item => {
      const time = new Date(item.timestamp).getTime();
      return !isNaN(time) && (now - time) < this.TWENTY_FOUR_HOURS_MS;
    });
    if (this.notificationHistory.length !== initialLength) {
      this.saveNotifications();
    }
  }

  private saveNotifications() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.notificationHistory));
    } catch (e) {
      console.warn('Failed to save notifications to localStorage', e);
    }
  }

  addNotification(key: string, message: string) {
    this.purgeOldNotifications();
    const validKey = (key && key.trim()) ? key.trim() : 'SYSTEM';
    this.notificationHistory.unshift({
      timestamp: new Date(),
      key: validKey,
      message
    });
    this.saveNotifications();
  }

  clearHistory() {
    this.notificationHistory = [];
    this.saveNotifications();
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

  /**
   * Listen to evaluation updates from the backend
   */
  onEvaluationUpdated(): Observable<{ userId: number; userEmail?: string; userName: string; period: string; globalScore: number; isPublished: boolean }> {
    return new Observable(observer => {
      this.socket.on('evaluation_updated', (data) => {
        observer.next(data);
      });
      return () => this.socket.off('evaluation_updated');
    });
  }
}
