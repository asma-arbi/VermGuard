import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrganizationService } from '../downtime/organization.service';
import { JiraService } from '../jira/jira.service';
import { UsersService } from '../users/users.service';
import axios from 'axios';
import type { Response } from 'express';

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

@Injectable()
export class CopilotService {
  private readonly logger = new Logger(CopilotService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly orgService: OrganizationService,
    private readonly jiraService: JiraService,
    private readonly usersService: UsersService,
  ) {}

  async processQuery(prompt: string, userRole: string = 'manager'): Promise<CopilotResponse> {
    this.logger.log(`🤖 Processing Cloudflare LLM query: "${prompt}" (role: ${userRole})`);

    // 1. Rassembler le contexte système VermGuard en temps réel
    const liveContext = await this.buildLiveSystemContext(prompt);

    // 2. Interroger Cloudflare Workers AI LLM (Llama 3.1 8B Instruct)
    const llmAnswer = await this.queryCloudflareLlama(prompt, liveContext, userRole);

    // 3. Détecter si une action de navigation interactive doit être suggérée
    const actionLink = this.detectActionLink(prompt);

    return {
      answer: llmAnswer,
      actionLink,
      suggestedPrompts: [
        'Fais-moi un résumé général de VermGuard',
        'Quelles sont les pannes récentes pour STT ?',
        'Quels sont les tickets Jira ouverts ?',
        'Donne-moi des conseils de cybersécurité SRE'
      ],
    };
  }

  /**
   * Streaming version — pipes Cloudflare SSE chunks directly to the HTTP response
   */
  async streamQuery(prompt: string, userRole: string = 'manager', res: Response): Promise<void> {
    this.logger.log(`🌊 Streaming Cloudflare LLM query: "${prompt}" (role: ${userRole})`);

    const accountId = this.configService.get<string>('CLOUDFLARE_ACCOUNT_ID', '3c87a93c0a25136616a3192261a3a254');
    const apiToken = this.configService.get<string>('CLOUDFLARE_API_TOKEN', '6Qz_5N6MB-0T8t49TFo3nFke9QRPFfYogxA6KwNX');
    const model = '@cf/meta/llama-3.1-8b-instruct';
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

    // Build context in parallel (max 12s wait for full Datadog API query)
    const liveContext = await Promise.race([
      this.buildLiveSystemContext(prompt),
      new Promise<string>((resolve) =>
        setTimeout(() => resolve('• Contexte partiel indisponible.\n'), 12000),
      ),
    ]);

    const systemPrompt = `Tu es VermGuard AI Copilot, assistant SRE & SOC de VermGuard.
Règles STRICTES :
- Tableaux Markdown 3 colonnes MAX, une ligne par élément, white-space:nowrap.
- Pour les pannes (quand demandé) : produis EXACTEMENT ces 2 tableaux dans cet ordre :

**X pannes URL — Y alertes infra actives pour [ORG]**

### Pannes d'URLs
| # | URL | Durée | Muté |
|---|-----|-------|------|
| 1 | domaine-court.net/path | 41m | Oui |

### Alertes Infrastructure
| # | Statut | Moniteur |
|---|--------|----------|
| 1 | 🔴 ALERT | Data Base ORA EXCEPTION |

- URL = domaine uniquement sans https://, sans www. Max 40 chars.
- Moniteur = nom sans préfixe org (STT-UAT, STT-PROD...). Max 30 chars.
- Réponds TOUJOURS en français.
`;

    const actionLink = this.detectActionLink(prompt);
    const suggestedPrompts = [
      'Fais-moi un résumé général de VermGuard',
      'Quelles sont les pannes récentes pour STT ?',
      'Quels sont les tickets Jira ouverts ?',
      'Donne-moi des conseils de cybersécurité SRE',
    ];

    try {
      // Inject context into the user message directly
      const userMessage = `[DONNÉES OFFICIELLES DE L'APPLICATION VERMGUARD]\n${liveContext}\n\nQuestion de l'utilisateur : ${prompt}`;

      const cfResponse = await axios.post(
        url,
        {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          stream: true,
          max_tokens: 1500,
        },
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          responseType: 'stream',
          timeout: 30000,
        },
      );

      let buffer = '';

      cfResponse.data.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        buffer += text;

        // Parse SSE lines from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // keep incomplete last line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data:')) continue;

          const jsonStr = trimmed.slice(5).trim();
          try {
            const parsed = JSON.parse(jsonStr);
            // Cloudflare streaming format: { response: "token" }
            const token =
              parsed.response ??
              parsed.choices?.[0]?.delta?.content ??
              parsed.choices?.[0]?.text ??
              '';

            if (token) {
              res.write(`data: ${JSON.stringify({ token })}\n\n`);
            }
          } catch {
            // Not valid JSON yet — skip
          }
        }
      });

      cfResponse.data.on('end', () => {
        // Send final metadata event
        res.write(
          `data: ${JSON.stringify({
            done: true,
            actionLink: actionLink ?? null,
            suggestedPrompts,
          })}\n\n`,
        );
        res.end();
        this.logger.log('✅ Streaming complete');
      });

      cfResponse.data.on('error', (err: Error) => {
        this.logger.error(`Stream error: ${err.message}`);
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      });

    } catch (err: any) {
      this.logger.error(`Cloudflare stream init error: ${err.message}`);
      res.write(`data: ${JSON.stringify({ error: 'Cloudflare API unavailable' })}\n\n`);
      res.end();
    }
  }

  /**
   * Appelle l'API Cloudflare Workers AI avec le modèle Llama-3.1-8b-instruct (non-streaming)
   */
  private async queryCloudflareLlama(prompt: string, systemContext: string, userRole: string): Promise<string> {
    const accountId = this.configService.get<string>('CLOUDFLARE_ACCOUNT_ID', '3c87a93c0a25136616a3192261a3a254');
    const apiToken = this.configService.get<string>('CLOUDFLARE_API_TOKEN', '6Qz_5N6MB-0T8t49TFo3nFke9QRPFfYogxA6KwNX');
    const model = '@cf/meta/llama-3.1-8b-instruct';
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

    const systemPrompt = `Tu es VermGuard AI Copilot, assistant SRE & SOC de VermGuard.
Règles STRICTES :
- Tableaux Markdown 3 colonnes MAX, une ligne par élément, white-space:nowrap.
- Pour les pannes (quand demandé) : produis EXACTEMENT ces 2 tableaux dans cet ordre :

**X pannes URL — Y alertes infra actives pour [ORG]**

### Pannes d'URLs
| # | URL | Durée | Muté |
|---|-----|-------|------|
| 1 | domaine-court.net/path | 41m | Oui |

### Alertes Infrastructure
| # | Statut | Moniteur |
|---|--------|----------|
| 1 | 🔴 ALERT | Data Base ORA EXCEPTION |

- URL = domaine uniquement sans https://, sans www. Max 40 chars.
- Moniteur = nom sans préfixe org (STT-UAT, STT-PROD...). Max 30 chars.
- Réponds TOUJOURS en français.
`;

    try {
      const userMessage = `[DONNÉES OFFICIELLES DE L'APPLICATION VERMGUARD]\n${systemContext}\n\nQuestion de l'utilisateur : ${prompt}`;

      const response = await axios.post(
        url,
        {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          max_tokens: 1500,
        },
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 25000,
        },
      );

      const result = response.data?.result;
      if (result) {
        let text = '';
        if (result.response) {
          text = result.response;
        } else if (result.choices && result.choices[0]?.message?.content) {
          text = result.choices[0].message.content;
        }

        if (text) {
          return text.trim();
        }
      }

      return `🤖 **VermGuard AI Copilot** : Je suis disponible pour répondre à vos questions. (Réponse générée sans texte).`;
    } catch (err: any) {
      this.logger.error(`Error querying Cloudflare Workers AI: ${err.message}`);
      return `⚠️ **Erreur IA Cloudflare** : Impossible de contacter l'API Cloudflare Workers AI. Veuillez vérifier vos identifiants Cloudflare.`;
    }
  }

  /**
   * Récupère le contexte live depuis Datadog, Jira et MySQL
   */
  /**
   * Récupère le contexte live depuis Datadog, Jira et MySQL
   */
  private async buildLiveSystemContext(prompt: string = ''): Promise<string> {
    let contextStr = '';
    const pUpper = prompt.toUpperCase();

    const [usersRes, orgsRes, ticketsRes] = await Promise.allSettled([
      this.usersService.findAll(),
      this.orgService.findAll(),
      Promise.all([
        this.jiraService.getTicketsForTeam('soc'),
        this.jiraService.getTicketsForTeam('support')
      ])
    ]);

    // 1. Users (local DB — ultra fast)
    if (usersRes.status === 'fulfilled' && usersRes.value) {
      const users = usersRes.value;
      const socUsers = users.filter(u => u.role === 'soc');
      const managerUsers = users.filter(u => u.role === 'manager');
      const otherUsers = users.filter(u => u.role !== 'soc' && u.role !== 'manager');

      contextStr += `• Total membres Vermeg : ${users.length} personnes.\n`;

      if (socUsers.length > 0) {
        contextStr += `• Analystes SOC (${socUsers.length}) :\n`;
        socUsers.forEach(u => {
          const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || (u as any).displayName || (u as any).username || u.email;
          const email = u.email ? ` — email: ${u.email}` : '';
          contextStr += `  - Nom: ${name}${email} (Rôle: Analyste SOC)\n`;
        });
      }

      if (managerUsers.length > 0) {
        contextStr += `• Managers (${managerUsers.length}) :\n`;
        managerUsers.forEach(u => {
          const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || (u as any).displayName || (u as any).username || u.email;
          contextStr += `  - Nom: ${name} (Rôle: Manager)\n`;
        });
      }

      if (otherUsers.length > 0) {
        contextStr += `• Autres membres (${otherUsers.length}) : ${otherUsers.map(u => [u.firstName, u.lastName].filter(Boolean).join(' ') || (u as any).displayName || u.email).join(', ')}\n`;
      }
    }

    // 2. Organizations & Real Datadog SLO Failure Events
    if (orgsRes.status === 'fulfilled' && orgsRes.value) {
      const orgs = orgsRes.value;
      contextStr += `• Organisations enregistrées (${orgs.length}) : ${orgs.map(o => o.orgName).join(', ')}\n`;

      // Detect matching organizations in prompt (e.g. STT, CARMIGNAC, LIFESTAR, SOLIAM-MT, etc.)
      const matchedOrgs = orgs.filter(o => pUpper.includes(o.orgName.toUpperCase()));
      const targetOrgs = matchedOrgs.length > 0 ? matchedOrgs : (orgs.length > 0 ? [orgs.find(o => o.orgName === 'STT') || orgs[0]] : []);

      for (const targetOrg of targetOrgs) {
        try {
          // A. Fetch ALL Datadog Monitors & Alerts (Infrastructure, DBs, Servers, ActiveMQ, Metric Alerts, APM)
          const headers = {
            'DD-API-KEY': targetOrg.apiKey,
            'DD-APPLICATION-KEY': targetOrg.appKey,
            'Content-Type': 'application/json',
          };
          const baseUrl = 'https://api.datadoghq.com';

          try {
            const monRes = await axios.get(`${baseUrl}/api/v1/monitor`, { headers, timeout: 6000 });
            const allMonitors = monRes.data || [];
            const activeAlerts = allMonitors.filter((m: any) => m.overall_state === 'Alert' || m.overall_state === 'Warn');

            contextStr += `\n• TOUS LES MONITEURS & ALERTES DATADOG EN DIRECT POUR ${targetOrg.orgName} (${allMonitors.length} moniteurs au total, ${activeAlerts.length} alerte(s) / avertissement(s) actif(s)) :\n`;

            if (activeAlerts.length > 0) {
              activeAlerts.forEach((m: any, idx: number) => {
                const stateSymbol = m.overall_state === 'Alert' ? '🔴 ALERT' : '🟡 WARN';
                // Strip common org prefixes and truncate name
                const shortName = m.name
                  .replace(/^STT-UAT\s+/i, '')
                  .replace(/^STT-PROD\s+/i, '')
                  .replace(/^STT\s+/i, '')
                  .replace(/^(CARMIGNAC|LIFESTAR|SOLIAM-MT|ICC|BFT)\s+/i, '')
                  .trim()
                  .slice(0, 35);
                contextStr += `  (${idx + 1}) [${stateSymbol}] ${shortName}\n`;
              });
            } else {
              contextStr += `  ✓ Aucun moniteur en état ALERT ou WARN actuellement sur l'ensemble de l'infrastructure Datadog de ${targetOrg.orgName}.\n`;
            }
          } catch (mErr: any) {
            this.logger.warn(`Impossible de consulter /api/v1/monitor pour ${targetOrg.orgName}: ${mErr.message}`);
          }

          // B. Fetch SLOs & URL Availability Failure History
          const sloRes = await this.orgService.getSlos(targetOrg.orgId);
          const slos = sloRes.slos || [];
          contextStr += `\n• HISTORIQUE DES PANNES SLO / URLS POUR ${targetOrg.orgName} (${slos.length} SLOs configurés) :\n`;

          for (const slo of slos) {
            const hist = await this.orgService.getSloHistory(targetOrg.orgId, slo.id);
            const uptime = hist.overall?.uptime !== undefined ? hist.overall.uptime.toFixed(3) + '%' : '100%';
            const downtimeMins = hist.overall?.downtimeMins || 0;
            const events: any[] = hist.downtimeHistory || [];

            contextStr += `  - SLO "${slo.name}" : Uptime ${uptime}, ${downtimeMins} min de panne cumulées, ${events.length} événement(s) de panne récents.\n`;

            if (events.length > 0) {
              contextStr += `    Pannes d'URLs pour ${targetOrg.orgName} :\n`;
              events.slice(0, 10).forEach((e, idx) => {
                // Short URL: remove protocol, truncate at 50 chars
                const rawUrl = e.url || 'URL inconnue';
                const shortUrl = rawUrl.replace(/^https?:\/\//, '').replace(/^www\./, '');
                const start = e.startTime ? new Date(e.startTime).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '?';
                const end = e.endTime ? new Date(e.endTime).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'En cours';
                const muted = e.isMuted || e.datadogDowntimeWindow ? 'Oui' : 'Non';
                contextStr += `      (${idx + 1}) URL: ${shortUrl} | ${start} → ${end} (${e.durationMins}m) | Muté: ${muted}\n`;
              });
            }
          }
        } catch (err: any) {
          this.logger.warn(`Erreur récupération SLO/Datadog pour ${targetOrg.orgName}: ${err.message}`);
        }
      }
    }

    // 3. Jira Tickets
    if (ticketsRes.status === 'fulfilled' && ticketsRes.value) {
      const [socTickets, supportTickets] = ticketsRes.value;
      const onPrem = socTickets.onPrem?.length || 0;
      const saas = socTickets.saas?.length || 0;
      const support = supportTickets.onPrem?.length || 0;
      contextStr += `• Tickets Jira en cours : ${onPrem + saas} tickets SOC (${onPrem} On-Prem, ${saas} SaaS), ${support} tickets Support.\n`;

      if (socTickets.onPrem && socTickets.onPrem.length > 0) {
        contextStr += `• Exemples de tickets SOC On-Prem : ${socTickets.onPrem.slice(0, 5).map((t: any) => `${t.key} (${t.fields?.summary || 'Sans titre'})`).join(', ')}\n`;
      }
      if (socTickets.saas && socTickets.saas.length > 0) {
        contextStr += `• Exemples de tickets SOC SaaS : ${socTickets.saas.slice(0, 5).map((t: any) => `${t.key} (${t.fields?.summary || 'Sans titre'})`).join(', ')}\n`;
      }
    }

    return contextStr;
  }

  /**
   * Détecte si un lien d'action d'interface utilisateur doit être suggéré
   */
  private detectActionLink(prompt: string): { type: 'nav' | 'jira' | 'url'; target: string; label: string } | undefined {
    const p = prompt.toLowerCase();
    if (p.includes('slo') || p.includes('datadog') || p.includes('panne') || p.includes('downtime') || p.includes('stt') || p.includes('icc') || p.includes('carmignac')) {
      return { type: 'nav', target: 'slo-guard', label: '⏱️ Ouvrir SLO Guard' };
    }
    if (p.includes('jira') || p.includes('ticket') || p.includes('incident')) {
      return { type: 'nav', target: 'tickets', label: '🎫 Ouvrir les Tickets Jira' };
    }
    if (p.includes('soc') || p.includes('analyste') || p.includes('performance')) {
      return { type: 'nav', target: 'soc-members', label: '📊 Ouvrir SOC Analytics' };
    }
    if (p.includes('user') || p.includes('utilisateur') || p.includes('membre') || p.includes('annuaire') || p.includes('staff')) {
      return { type: 'nav', target: 'directory', label: '👥 Ouvrir Staff Directory' };
    }
    return undefined;
  }
}
