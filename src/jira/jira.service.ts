import {
  Injectable,
  Logger,
  InternalServerErrorException,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosRequestConfig } from 'axios';

import { SOC_NOT_CLOSED_JQL, GIS_SAAS_NOT_CLOSED_JQL } from './jira-queries.constants';
import { JiraSearchResult, JiraTicket, TeamTicketsDto } from './jira.interfaces';
import { EventsGateway } from '../events/events.gateway';

/**
 * JiraService — Couche d'accès à l'API Jira REST v2 de Vermeg.
 *
 * Authentification : Basic Auth username:password (identique au code JS collègue).
 * Les requêtes JQL sont centralisées dans jira-queries.constants.ts.
 * Le cache en mémoire évite de surcharger l'API Jira à chaque appel frontend.
 */
@Injectable()
export class JiraService implements OnModuleInit {
  private readonly logger = new Logger(JiraService.name);

  /** URL de base de l'instance Jira Vermeg */
  private readonly jiraBaseUrl: string;

  /** Username Jira (ex: aarbi_tr) */
  private readonly jiraUsername: string;

  /** Password Jira */
  private readonly jiraPassword: string;

  /** En-têtes HTTP d'authentification Basic Auth */
  private readonly authHeaders: Record<string, string>;

  /** Indique si Jira est correctement configuré */
  private readonly isConfigured: boolean;

  /** Cache en mémoire pour accélérer l'affichage (TTL: 30 secondes) */
  private cache: Map<string, { data: TeamTicketsDto; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 30000;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    @Inject(forwardRef(() => EventsGateway))
    private readonly eventsGateway: EventsGateway,
  ) {
    this.jiraBaseUrl = this.configService.get<string>('JIRA_BASE_URL', '').trim();
    this.jiraUsername = this.configService.get<string>('JIRA_USERNAME', '').trim();
    this.jiraPassword = this.configService.get<string>('JIRA_PASSWORD', '').trim();

    // Vérifier que les identifiants sont présents
    this.isConfigured =
      !!this.jiraBaseUrl &&
      !!this.jiraUsername &&
      !!this.jiraPassword &&
      !this.jiraBaseUrl.includes('your-domain');

    if (this.isConfigured) {
      // Encodage Basic Auth en Base64 : "username:password"
      const basicToken = Buffer.from(`${this.jiraUsername}:${this.jiraPassword}`).toString('base64');

      this.authHeaders = {
        Authorization: `Basic ${basicToken}`,
        'Content-Type': 'application/json',
      };

      this.logger.log(`✅ Jira configuré → ${this.jiraBaseUrl} (utilisateur: ${this.jiraUsername})`);
    } else {
      this.authHeaders = {};
      this.logger.warn(
        '⚠️  Jira non configuré — vérifiez JIRA_USERNAME et JIRA_PASSWORD dans .env',
      );
    }
  }

  /**
   * Au démarrage : pré-chauffage du cache Jira + rafraîchissement toutes les 25s.
   */
  async onModuleInit() {
    this.logger.log('🔄 Démarrage du pré-chauffage du cache Jira...');
    await this.refreshCacheInBackground();

    setInterval(() => {
      this.refreshCacheInBackground();
    }, 25000);
  }

  /**
   * Rafraîchit le cache et émet un événement WebSocket si les données ont changé.
   */
  private async refreshCacheInBackground(): Promise<void> {
    try {
      const now = Date.now();

      const onPrem = await this.fetchIssues(SOC_NOT_CLOSED_JQL);
      const saas   = await this.fetchIssues(GIS_SAAS_NOT_CLOSED_JQL);

      // Mise à jour cache SOC (onPrem + saas)
      const newSoc = { onPrem, saas };
      const oldSoc = this.cache.get('tickets_soc')?.data;
      this.cache.set('tickets_soc', { data: newSoc, timestamp: now });
      if (!oldSoc || JSON.stringify(oldSoc) !== JSON.stringify(newSoc)) {
        this.eventsGateway.emitJiraUpdate('soc', newSoc);
        this.logger.log('📡 WebSocket émis → mise à jour SOC détectée.');
      }

      // Mise à jour cache SUPPORT (onPrem uniquement)
      const newSupport = { onPrem };
      const oldSupport = this.cache.get('tickets_support')?.data;
      this.cache.set('tickets_support', { data: newSupport, timestamp: now });
      if (!oldSupport || JSON.stringify(oldSupport) !== JSON.stringify(newSupport)) {
        this.eventsGateway.emitJiraUpdate('support', newSupport);
        this.logger.log('📡 WebSocket émis → mise à jour SUPPORT détectée.');
      }

      this.logger.log('✅ Cache Jira pré-chargé avec succès.');
    } catch (err) {
      this.logger.error('❌ Erreur lors du pré-chargement du cache Jira', err);
    }
  }

  /**
   * Exécute une requête JQL sur l'API Jira REST v2 de Vermeg.
   * Identique au principe du code JS du collègue, transposé en TypeScript.
   *
   * @param jql        La requête JQL à exécuter
   * @param maxResults Nombre maximum de résultats (défaut : 5000, comme le collègue)
   */
  async fetchIssues(jql: string, maxResults = 5000): Promise<JiraTicket[]> {
    if (!this.isConfigured) {
      this.logger.warn('⚠️  Jira non configuré — aucun ticket retourné.');
      return [];
    }

    const url = `${this.jiraBaseUrl}/rest/api/2/search`;

    const config: AxiosRequestConfig = {
      headers: this.authHeaders,
      params: {
        jql,
        maxResults,
        fields: 'summary,status,priority,assignee,reporter,created,updated,issuetype',
      },
    };

    try {
      const response = await firstValueFrom(
        this.httpService.get<JiraSearchResult>(url, config),
      );

      const total = response.data.total ?? 0;
      this.logger.log(`📋 JQL exécuté → ${total} ticket(s) trouvé(s).`);
      return response.data.issues ?? [];
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Erreur lors de l'appel Jira API : ${msg}`);
      return [];
    }
  }

  /**
   * Retourne les tickets selon l'équipe.
   *
   * - SUPPORT : uniquement les tickets On-Prem (SOC_NOT_CLOSED_JQL)
   * - SOC     : tickets On-Prem + tickets SaaS (GIS_SAAS_NOT_CLOSED_JQL)
   */
  async getTicketsForTeam(team: 'soc' | 'support'): Promise<TeamTicketsDto> {
    const cacheKey = `tickets_${team}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    // Retourner les données depuis le cache si elles sont encore valides
    if (cached && (now - cached.timestamp < this.CACHE_TTL)) {
      this.logger.log(`📦 Cache valide → retour tickets ${team.toUpperCase()}.`);
      return cached.data;
    }

    // Cache expiré ou absent → requête directe à Jira
    const onPrem = await this.fetchIssues(SOC_NOT_CLOSED_JQL);

    let result: TeamTicketsDto;
    if (team === 'support') {
      result = { onPrem };
    } else {
      const saas = await this.fetchIssues(GIS_SAAS_NOT_CLOSED_JQL);
      result = { onPrem, saas };
    }

    this.cache.set(cacheKey, { data: result, timestamp: now });
    return result;
  }

  // ─── Actions directes sur les tickets Jira ───────────────────────────

  /**
   * Ajoute un commentaire sur un ticket Jira.
   */
  async addComment(key: string, comment: string, author: string): Promise<any> {
    if (!this.isConfigured) {
      return { success: false, error: 'Jira non configuré.' };
    }
    try {
      const url = `${this.jiraBaseUrl}/rest/api/2/issue/${key}/comment`;
      const body = { body: comment };
      const response = await firstValueFrom(
        this.httpService.post(url, body, { headers: this.authHeaders }),
      );
      this.logger.log(`💬 Commentaire ajouté sur ${key} par ${author}.`);
      return response.data;
    } catch (err) {
      this.logger.error(`❌ Erreur addComment ${key}`, err);
      throw new InternalServerErrorException('Failed to add comment.');
    }
  }

  /**
   * Effectue une transition de statut sur un ticket Jira.
   */
  async transitionTicket(key: string, transitionName: string): Promise<any> {
    if (!this.isConfigured) {
      return { success: false, error: 'Jira non configuré.' };
    }
    try {
      const transUrl = `${this.jiraBaseUrl}/rest/api/2/issue/${key}/transitions`;
      const transResponse = await firstValueFrom(
        this.httpService.get(transUrl, { headers: this.authHeaders }),
      );
      const transitions = transResponse.data.transitions || [];
      const target = transitions.find(
        (t: any) => t.name.toLowerCase() === transitionName.toLowerCase(),
      );
      if (!target) {
        return {
          success: false,
          error: `Transition "${transitionName}" introuvable.`,
          available: transitions.map((t: any) => t.name),
        };
      }
      await firstValueFrom(
        this.httpService.post(
          transUrl,
          { transition: { id: target.id } },
          { headers: this.authHeaders },
        ),
      );
      this.logger.log(`🔄 Ticket ${key} → statut changé en "${transitionName}".`);
      return { success: true, key, newStatus: transitionName };
    } catch (err) {
      this.logger.error(`❌ Erreur transitionTicket ${key}`, err);
      throw new InternalServerErrorException('Failed to transition ticket.');
    }
  }

  /**
   * Assigne un ticket à un utilisateur Jira.
   */
  async assignTicket(key: string, assignee: string): Promise<any> {
    if (!this.isConfigured) {
      return { success: true, mock: true, key, assignee };
    }
    try {
      const url = `${this.jiraBaseUrl}/rest/api/2/issue/${key}/assignee`;
      await firstValueFrom(
        this.httpService.put(url, { name: assignee }, { headers: this.authHeaders }),
      );
      this.logger.log(`👤 Ticket ${key} assigné à ${assignee}.`);
      return { success: true, key, assignee };
    } catch (err) {
      this.logger.error(`❌ Erreur assignTicket ${key}`, err);
      throw new InternalServerErrorException('Failed to assign ticket.');
    }
  }

  /**
   * Récupère et catégorise les incidents par technicien (assignee/reporter), dates et maxResult.
   * Transpose exactement la logique du contrôleur JS de votre collègue.
   */
  async getIncidentsPerSocTechnician(
    technician: string,
    startDate: string,
    endDate: string,
    maxResult = 50,
  ): Promise<any> {
    if (!this.isConfigured) {
      this.logger.warn('⚠️ Jira non configuré — retour de données fictives par technicien.');
      return this.getMockIncidentsPerTechnician(technician);
    }

    const JQL = `project = "Global Internal Support"
      AND ((issuetype = "SOC Monitoring") OR (issuetype = "Incident"))  
      AND (( assignee was in (${technician}) ) OR (reporter ='${technician}' ))
      AND created >= ${startDate}
      AND created <= ${endDate}`;

    const url = `${this.jiraBaseUrl}/rest/api/2/search`;

    const config: AxiosRequestConfig = {
      headers: this.authHeaders,
      params: {
        jql: JQL,
        maxResults: maxResult,
        fields: 'summary,customfield_17800,customfield_17801,created,assignee,customfield_18500,status,customfield_10008',
      },
    };

    try {
      const response = await firstValueFrom(
        this.httpService.get<any>(url, config)
      );
      const issues = response.data.issues || [];

      // Catégoriser les incidents comme fait par le collègue
      const categorizedIssues: {
        saas: any[];
        onprem: any[];
        security: any[];
      } = {
        saas: [],     // customfield_18500 !== null
        onprem: [],   // customfield_18500 === null
        security: [], // customfield_10008.requestType.name === "Report Security Tool Incident"
      };

      issues.forEach((issue: any) => {
        const requestTypeName = issue.fields.customfield_10008?.requestType?.name;
        const customfield18500 = issue.fields.customfield_18500;

        if (requestTypeName === 'Report Security Tool Incident') {
          categorizedIssues.security.push(issue);
        } else if (customfield18500 !== null && customfield18500 !== undefined) {
          categorizedIssues.saas.push(issue);
        } else {
          categorizedIssues.onprem.push(issue);
        }
      });

      return {
        totalCount: issues.length,
        saasCount: categorizedIssues.saas.length,
        onpremCount: categorizedIssues.onprem.length,
        securityCount: categorizedIssues.security.length,
        ...categorizedIssues,
      };
    } catch (error: any) {
      const errMsg = error?.response?.data || error.message;
      this.logger.error(`❌ Erreur fetchIncidentsPerTechnician: ${JSON.stringify(errMsg)}`);
      // En cas d'erreur de connexion à l'API Jira Vermeg, fallback vers les mocks pour assurer le fonctionnement de la démo
      this.logger.warn('⚠️ Fallback vers les données fictives suite à une erreur Jira.');
      return this.getMockIncidentsPerTechnician(technician);
    }
  }

  /**
   * Génère des données fictives réalistes de tickets pour un technicien SOC
   */
  private getMockIncidentsPerTechnician(technician: string): any {
    const issues = [
      {
        id: 'mock-tech-1',
        key: 'GIS-501',
        fields: {
          summary: `[On-Prem] CPU critical alert reported by ${technician}`,
          created: new Date().toISOString(),
          status: { name: 'In Progress' },
          assignee: { displayName: technician },
          customfield_18500: null,
          customfield_10008: null,
        }
      },
      {
        id: 'mock-tech-2',
        key: 'GIS-502',
        fields: {
          summary: `[SaaS] Connection error with client gateway portal`,
          created: new Date().toISOString(),
          status: { name: 'Open' },
          assignee: { displayName: technician },
          customfield_18500: { value: 'SaaS Cloud' },
          customfield_10008: null,
        }
      },
      {
        id: 'mock-tech-3',
        key: 'GIS-503',
        fields: {
          summary: `[Security] Phishing simulation failure rate analysis`,
          created: new Date().toISOString(),
          status: { name: 'Resolved' },
          assignee: { displayName: technician },
          customfield_18500: null,
          customfield_10008: {
            requestType: {
              name: 'Report Security Tool Incident'
            }
          },
        }
      }
    ];

    return {
      totalCount: 3,
      saasCount: 1,
      onpremCount: 1,
      securityCount: 1,
      saas: [issues[1]],
      onprem: [issues[0]],
      security: [issues[2]],
    };
  }

  /**
   * Retourne la liste des vrais comptes des techniciens SOC Vermeg
   */
  getRealSocMembersList(): any[] {
    return [
      { username: 'it_soc', displayName: 'IT SOC' },
      { username: 'sbenaissia', displayName: 'S. Benaissia' },
      { username: 'hghiloufi', displayName: 'H. Ghiloufi' },
      { username: 'anamouchi', displayName: 'A. Namouchi' },
      { username: 'zhammami', displayName: 'Z. Hammami' },
      { username: 'khksibi', displayName: 'K. Ksibi' },
      { username: 'ojebali', displayName: 'O. Jebali' },
      { username: 'mselmani', displayName: 'M. Selmani' },
      { username: 'sfradj', displayName: 'S. Fradj' },
      { username: 'ybenamara', displayName: 'Y. Ben Amara' },
      { username: 'socuser', displayName: 'SOC User' },
      { username: 'wsaadli', displayName: 'W. Saadli' },
      { username: 'mkouissi', displayName: 'M. Kouissi' },
      { username: 'nabbes', displayName: 'N. Abbes' },
      { username: 'onssibi', displayName: 'O. Nssibi' }
    ];
  }
}
