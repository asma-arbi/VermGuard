import { Injectable, Logger, InternalServerErrorException, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosRequestConfig, AxiosResponse } from 'axios';

import { SOC_NOT_CLOSED_JQL, GIS_SAAS_NOT_CLOSED_JQL } from './jira-queries.constants';
import {
  JiraSearchResult,
  JiraTicket,
  TeamTicketsDto,
} from './jira.interfaces';
import { EventsGateway } from '../events/events.gateway';

/**
 * JiraService — Couche d'accès à l'API Jira REST v3.
 *
 * Conception extensible :
 * - Toutes les requêtes JQL sont centralisées dans jira-queries.constants.ts
 * - Pour ajouter un filtre (ex: date), modifier la constante JQL ou ajouter
 *   un paramètre optionnel à searchIssues() sans toucher au reste.
 */
@Injectable()
export class JiraService implements OnModuleInit {
  private readonly logger = new Logger(JiraService.name);

  /** URL de base de l'instance Jira (ex: https://jira.vermeg.com) */
  private readonly jiraBaseUrl: string;

  /** En-têtes HTTP d'authentification Jira */
  private readonly authHeaders: Record<string, string>;

  /** Indique si Jira est correctement configuré */
  private readonly isConfigured: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    @Inject(forwardRef(() => EventsGateway))
    private readonly eventsGateway: EventsGateway,
  ) {
    this.jiraBaseUrl = this.configService.get<string>('JIRA_BASE_URL', '').trim();
    const email = this.configService.get<string>('JIRA_EMAIL', '').trim();
    const token = this.configService.get<string>('JIRA_API_TOKEN', '').trim();

    // Détecter si la config est une valeur placeholder (non configurée)
    const isPlaceholder =
      !this.jiraBaseUrl ||
      this.jiraBaseUrl.includes('your-domain') ||
      !email ||
      email.includes('your-email') ||
      !token ||
      token.includes('your_api_token');

    this.isConfigured = !isPlaceholder;

    if (this.isConfigured) {
      // Le token dans .env peut être soit un token brut, soit déjà en Base64
      // On détecte si c'est déjà encodé (pas de ':' dans le token décodé)
      let authToken: string;
      try {
        const decoded = Buffer.from(token, 'base64').toString('utf8');
        if (decoded.includes(':') || decoded.includes('@')) {
          // Déjà encodé en Base64 (email:token)
          authToken = token;
          this.logger.log('Utilisation du token Base64 déjà encodé depuis .env');
        } else {
          // Token brut — on doit l'encoder avec l'email
          authToken = Buffer.from(`${email}:${token}`).toString('base64');
          this.logger.log('Encodage Basic Auth email:token');
        }
      } catch {
        authToken = Buffer.from(`${email}:${token}`).toString('base64');
      }

      this.authHeaders = {
        Authorization: `Basic ${authToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      this.logger.log(`Jira configuré → ${this.jiraBaseUrl}`);
    } else {
      this.authHeaders = {};
      this.logger.warn('Jira non configuré — mode données fictives activé.');
    }
  }

  async onModuleInit() {
    this.logger.log('Démarrage du pre-warming (pré-chauffage) du cache Jira...');
    this.refreshCacheInBackground();
    // Rafraîchir le cache automatiquement toutes les 25 secondes
    setInterval(() => {
      this.refreshCacheInBackground();
    }, 25000);
  }

  private async refreshCacheInBackground() {
    try {
      const now = Date.now();
      const onPrem = await this.searchIssues(SOC_NOT_CLOSED_JQL);
      const saas = await this.searchIssues(GIS_SAAS_NOT_CLOSED_JQL);
      
      const newSoc = { onPrem, saas };
      const oldSoc = this.cache.get('tickets_soc')?.data;
      this.cache.set('tickets_soc', { data: newSoc, timestamp: now });
      if (oldSoc && JSON.stringify(oldSoc) !== JSON.stringify(newSoc)) {
        this.eventsGateway.emitJiraUpdate('soc', newSoc);
      }
      
      const newSupport = { onPrem };
      const oldSupport = this.cache.get('tickets_support')?.data;
      this.cache.set('tickets_support', { data: newSupport, timestamp: now });
      if (oldSupport && JSON.stringify(oldSupport) !== JSON.stringify(newSupport)) {
        this.eventsGateway.emitJiraUpdate('support', newSupport);
      }
      
      this.logger.log('Cache Jira mis à jour avec succès en arrière-plan (Pre-warmed)');
    } catch (err) {
      this.logger.error('Erreur lors du pré-chargement en arrière-plan', err);
    }
  }

  // Cache en mémoire pour accélérer l'affichage des tickets (TTL: 30 secondes)
  private cache: Map<string, { data: TeamTicketsDto; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 30000; // 30 secondes de validité

  /**
   * Exécute une requête JQL sur l'API Jira et retourne tous les tickets trouvés.
   *
   * Extension future : ajouter `filters?: { since?: string }` pour filtrer par date
   * et composer le JQL dynamiquement avant l'appel HTTP.
   *
   * @param jql        La requête JQL à exécuter
   * @param maxResults Nombre maximum de résultats (défaut : 100)
   */
  async searchIssues(jql: string, maxResults = 100): Promise<JiraTicket[]> {
    // Mode fallback si Jira n'est pas configuré
    if (!this.isConfigured) {
      this.logger.warn('Jira non configuré — retour de données fictives.');
      return this.getMockTickets(jql);
    }

    const url = `${this.jiraBaseUrl}/rest/api/2/search`;

    const config: AxiosRequestConfig = {
      headers: this.authHeaders,
      params: {
        jql,
        maxResults,
        fields: 'summary,status,priority,assignee,reporter,created,updated',
      },
    };

    try {
      const response: AxiosResponse<JiraSearchResult> = await firstValueFrom(
        this.httpService.get<JiraSearchResult>(url, config),
      );
      this.logger.log(
        `Jira JQL exécuté — ${response.data.total} ticket(s) trouvé(s).`,
      );
      return response.data.issues ?? [];
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Erreur lors de l'appel Jira : ${msg}`);
      // En cas d'erreur API, retourner les données fictives plutôt que de faire planter
      this.logger.warn('Fallback vers les données fictives suite à l\'erreur Jira.');
      return this.getMockTickets(jql);
    }
  }

  /**
   * Retourne les tickets selon l'équipe demandée.
   *
   * - SUPPORT : uniquement les tickets On-Prem (SOC_NOT_CLOSED_JQL)
   * - SOC     : tickets On-Prem + tickets SaaS (GIS_SAAS_NOT_CLOSED_JQL)
   *
   * @param team 'soc' ou 'support'
   */
  async getTicketsForTeam(team: 'soc' | 'support'): Promise<TeamTicketsDto> {
    const cacheKey = `tickets_${team}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    // Si les données sont déjà en cache et valides, on les retourne immédiatement
    if (cached && (now - cached.timestamp < this.CACHE_TTL)) {
      this.logger.log(`Retour des tickets Jira depuis le cache pour l'équipe: ${team}`);
      return cached.data;
    }

    // Sinon, on fait les requêtes Jira
    const onPrem = await this.searchIssues(SOC_NOT_CLOSED_JQL);

    let result: TeamTicketsDto;
    if (team === 'support') {
      // L'équipe SUPPORT voit uniquement les tickets On-Prem
      result = { onPrem };
    } else {
      // L'équipe SOC voit aussi les tickets SaaS
      const saas = await this.searchIssues(GIS_SAAS_NOT_CLOSED_JQL);
      result = { onPrem, saas };
    }

    // Mise en cache du résultat
    this.cache.set(cacheKey, { data: result, timestamp: now });
    return result;
  }

  /**
   * Données fictives pour le développement ou en cas d'erreur Jira.
   */
  private getMockTickets(jql: string): JiraTicket[] {
    const isSaaS = jql.includes('SaaS') || jql.includes('GIS');
    const baseUrl = this.jiraBaseUrl || 'https://example.atlassian.net';

    return [
      {
        id: isSaaS ? '20001' : '10001',
        key: isSaaS ? 'GIS-101' : 'SOC-201',
        self: `${baseUrl}/browse/${isSaaS ? 'GIS-101' : 'SOC-201'}`,
        fields: {
          summary: isSaaS
            ? '[DEMO] SaaS — Ticket non fermé exemple'
            : '[DEMO] On-Prem — Ticket non fermé exemple',
          status: { name: 'In Progress' },
          priority: { name: 'High' },
          assignee: {
            displayName: 'John Doe',
            emailAddress: 'john.doe@vermeg.com',
          },
          reporter: { displayName: 'Jane Smith' },
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
        },
      },
      {
        id: isSaaS ? '20002' : '10002',
        key: isSaaS ? 'GIS-102' : 'SOC-202',
        self: `${baseUrl}/browse/${isSaaS ? 'GIS-102' : 'SOC-202'}`,
        fields: {
          summary: isSaaS
            ? '[DEMO] SaaS — Connexion intermittente dashboard client'
            : '[DEMO] On-Prem — Alerte CPU serveur prod dépassée 90%',
          status: { name: 'Open' },
          priority: { name: 'Medium' },
          assignee: null,
          reporter: { displayName: 'Alice Martin' },
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
        },
      },
      {
        id: isSaaS ? '20003' : '10003',
        key: isSaaS ? 'GIS-103' : 'SOC-203',
        self: `${baseUrl}/browse/${isSaaS ? 'GIS-103' : 'SOC-203'}`,
        fields: {
          summary: isSaaS
            ? '[DEMO] SaaS — Expiration certificat SSL dans 7 jours'
            : '[DEMO] On-Prem — Échec sauvegarde nocturne base de données',
          status: { name: 'In Progress' },
          priority: { name: 'Critical' },
          assignee: {
            displayName: 'Bob Dupont',
            emailAddress: 'bob.dupont@vermeg.com',
          },
          reporter: { displayName: 'Marc Leroy' },
          created: new Date(Date.now() - 86400000).toISOString(),
          updated: new Date().toISOString(),
        },
      },
    ];
  }

  /**
   * Ajoute un commentaire sur un ticket Jira.
   * Si Jira est configuré, appelle l'API REST. Sinon, retourne un mock.
   */
  async addComment(key: string, comment: string, author: string): Promise<any> {
    if (!this.isConfigured) {
      this.logger.warn(`[MOCK] Commentaire ajouté sur ${key} par ${author}: "${comment}"`);
      return { success: true, mock: true, key, comment, author };
    }
    try {
      const url = `${this.jiraBaseUrl}/rest/api/3/issue/${key}/comment`;
      const body = {
        body: {
          type: 'doc', version: 1,
          content: [{ type: 'paragraph', content: [{ type: 'text', text: comment }] }]
        }
      };
      const response = await firstValueFrom(
        this.httpService.post(url, body, { headers: this.authHeaders })
      );
      return response.data;
    } catch (err) {
      this.logger.error(`Erreur addComment ${key}`, err);
      throw new InternalServerErrorException('Failed to add comment.');
    }
  }

  /**
   * Change le statut d'un ticket Jira via une transition.
   * Si Jira est configuré, appelle l'API REST. Sinon, retourne un mock.
   */
  async transitionTicket(key: string, transitionName: string): Promise<any> {
    if (!this.isConfigured) {
      this.logger.warn(`[MOCK] Transition de ${key} vers "${transitionName}"`);
      return { success: true, mock: true, key, transitionName };
    }
    try {
      // Récupérer les transitions disponibles pour ce ticket
      const transUrl = `${this.jiraBaseUrl}/rest/api/3/issue/${key}/transitions`;
      const transResponse = await firstValueFrom(
        this.httpService.get(transUrl, { headers: this.authHeaders })
      );
      const transitions = transResponse.data.transitions || [];
      const target = transitions.find(
        (t: any) => t.name.toLowerCase() === transitionName.toLowerCase()
      );
      if (!target) {
        return { success: false, error: `Transition "${transitionName}" not found.`, available: transitions.map((t: any) => t.name) };
      }
      // Effectuer la transition
      const doUrl = `${this.jiraBaseUrl}/rest/api/3/issue/${key}/transitions`;
      await firstValueFrom(
        this.httpService.post(doUrl, { transition: { id: target.id } }, { headers: this.authHeaders })
      );
      return { success: true, key, newStatus: transitionName };
    } catch (err) {
      this.logger.error(`Erreur transitionTicket ${key}`, err);
      throw new InternalServerErrorException('Failed to transition ticket.');
    }
  }

  /**
   * Assigne un ticket à un utilisateur Jira.
   * Si Jira est configuré, appelle l'API REST. Sinon, retourne un mock.
   */
  async assignTicket(key: string, assignee: string): Promise<any> {
    if (!this.isConfigured) {
      this.logger.warn(`[MOCK] Ticket ${key} assigné à ${assignee}`);
      return { success: true, mock: true, key, assignee };
    }
    try {
      const url = `${this.jiraBaseUrl}/rest/api/3/issue/${key}/assignee`;
      const response = await firstValueFrom(
        this.httpService.put(url, { name: assignee }, { headers: this.authHeaders })
      );
      return { success: true, key, assignee };
    } catch (err) {
      this.logger.error(`Erreur assignTicket ${key}`, err);
      throw new InternalServerErrorException('Failed to assign ticket.');
    }
  }
}
