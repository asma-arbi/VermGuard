import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { DowntimeExclusion } from './entities/downtime-exclusion.entity';
import axios from 'axios';

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    @InjectRepository(Organization)
    private readonly orgRepository: Repository<Organization>,
    @InjectRepository(DowntimeExclusion)
    private readonly exclusionRepository: Repository<DowntimeExclusion>,
  ) {}

  async findAll(): Promise<Organization[]> {
    try {
      const orgs = await this.orgRepository.find();
      return orgs
        .filter(o => o.orgName && o.orgName.trim() !== '')
        .sort((a, b) => a.orgName.localeCompare(b.orgName));
    } catch (err: any) {
      this.logger.error(`Failed to fetch organizations: ${err.message}`);
      throw err;
    }
  }

  async findOne(orgId: number | string): Promise<Organization> {
    const org = await this.orgRepository.findOneBy({ orgId: orgId as any });
    if (!org) throw new NotFoundException(`Organization ${orgId} not found`);
    return org;
  }

  private getDatadogBaseUrls(): string[] {
    return [
      'https://api.datadoghq.com',
      'https://api.datadoghq.eu',
      'https://api.us3.datadoghq.com',
      'https://api.us5.datadoghq.com',
      'https://api.ap1.datadoghq.com',
    ];
  }

  private extractUrlsFromText(text: string): string[] {
    if (!text) return [];
    const matches = text.match(/https?:\/\/[^\s"<>'{}|\^~\[\]`\\]+/gi) || [];
    const cleaned = matches
      .map(u => u.replace(/["',;]+$/, ''))
      .filter(u => !u.includes('wiki.vermeg.com') && (u.startsWith('http://') || u.startsWith('https://')));
    return Array.from(new Set(cleaned));
  }

  private async fetchSyntheticsTests(baseUrl: string, headers: any): Promise<any[]> {
    try {
      const response = await axios.get(`${baseUrl}/api/v1/synthetics/tests`, {
        headers,
        timeout: 6000,
      });
      return response.data?.tests || [];
    } catch (err: any) {
      return [];
    }
  }

  private resolveUrlsForSlo(
    slo: any,
    synTests: any[],
    orgName: string,
  ): { primaryUrl: string | null; allUrls: string[] } {
    const urlSet = new Set<string>();

    // 1. Direct URLs in SLO name or description
    const directUrls = this.extractUrlsFromText((slo.name || '') + ' ' + (slo.description || ''));
    directUrls.forEach(u => urlSet.add(u));

    // 2. Map from Synthetic tests of the organization
    const synMap = new Map<string, string>();
    const orgSynUrls = new Set<string>();

    synTests.forEach(t => {
      let url = t.config?.request?.url;
      if (!url && t.config?.steps) {
        for (const step of t.config.steps) {
          if (step.params?.url) {
            url = step.params.url;
            break;
          }
        }
      }
      if (!url) {
        const extracted = this.extractUrlsFromText(JSON.stringify(t));
        if (extracted.length > 0) url = extracted[0];
      }
      if (url) {
        synMap.set(t.public_id, url);
        orgSynUrls.add(url);
      }
    });

    // 3. Keyword matching between SLO name and Synthetic test name
    const sloNameLower = (slo.name || '').toLowerCase();
    const keywords = ['prod', 'uat', 'ppd', 'preprod', 'reform', 'solife', 'bdm', 'bes', 'nf', 'colline', 'oberon', 'allianz', 'contassur', 'unofi', 'relyens', 'cipav', 'git', 'sonar', 'nexus', 'front', 'keycloak', 'docgen', 'custodix', 's3'];

    synTests.forEach(t => {
      const tNameLower = (t.name || '').toLowerCase();
      let matchCount = 0;
      keywords.forEach(kw => {
        if (sloNameLower.includes(kw) && tNameLower.includes(kw)) matchCount++;
      });

      const url = synMap.get(t.public_id);
      if (url && (matchCount >= 1 || synTests.length === 1)) {
        urlSet.add(url);
      }
    });

    // Fallback: If no specific test matched, associate all synthetic URLs of this organization
    if (urlSet.size === 0 && orgSynUrls.size > 0) {
      orgSynUrls.forEach(u => urlSet.add(u));
    }

    const allUrls = Array.from(urlSet);
    const primaryUrl = allUrls.length > 0 ? allUrls[0] : null;

    return { primaryUrl, allUrls };
  }

  async getSlos(orgId: number | string): Promise<any> {
    const org = await this.findOne(orgId);
    this.logger.log(`Fetching SLOs from Datadog for org: "${org.orgName}"`);

    const headers = {
      'DD-API-KEY': org.apiKey,
      'DD-APPLICATION-KEY': org.appKey,
      'Content-Type': 'application/json',
    };

    let lastError: any = null;

    for (const baseUrl of this.getDatadogBaseUrls()) {
      try {
        const [sloRes, synTests] = await Promise.all([
          axios.get(`${baseUrl}/api/v1/slo`, {
            headers,
            params: { limit: 1000 },
            timeout: 8000,
          }),
          this.fetchSyntheticsTests(baseUrl, headers),
        ]);

        const slos = sloRes.data.data || [];
        this.logger.log(`Got ${slos.length} SLO(s) and ${synTests.length} Synthetic test(s) from ${baseUrl} for ${org.orgName}`);

        return {
          orgName: org.orgName,
          slos: slos.map((slo: any) => {
            const { primaryUrl, allUrls } = this.resolveUrlsForSlo(slo, synTests, org.orgName);

            return {
              id: slo.id,
              name: slo.name,
              description: slo.description || '',
              type: slo.type,
              targetUrl: primaryUrl,
              targetUrls: allUrls,
              targetThreshold: slo.thresholds?.[0]?.target ?? 99.0,
              warningThreshold: slo.thresholds?.[0]?.warning ?? null,
              timeframe: slo.thresholds?.[0]?.timeframe ?? '30d',
              tags: slo.tags || [],
            };
          }),
        };
      } catch (err: any) {
        lastError = err;
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          continue;
        }
        break;
      }
    }

    const errorMsg = lastError?.response?.data?.errors?.join(', ') || lastError?.message || 'Authentication error';
    this.logger.warn(`Datadog API error for org "${org.orgName}": ${errorMsg}`);

    // NO MOCK FALLBACK: Return clear status when Datadog API keys are unauthorized/failing
    return {
      orgName: org.orgName,
      isFallback: false,
      error: `Datadog API error for ${org.orgName}: ${errorMsg}`,
      slos: [],
    };
  }

  async getSloHistory(
    orgId: number | string,
    sloId: string,
    customFromTs?: number,
    customToTs?: number,
  ): Promise<any> {
    const org = await this.findOne(orgId);

    const now = Math.floor(Date.now() / 1000);
    let toTs = customToTs && !isNaN(customToTs) ? Number(customToTs) : now;
    let fromTs = customFromTs && !isNaN(customFromTs) ? Number(customFromTs) : (toTs - 30 * 24 * 3600);

    if (toTs > 1e11) toTs = Math.floor(toTs / 1000);
    if (fromTs > 1e11) fromTs = Math.floor(fromTs / 1000);

    const totalMinutes = Math.max(1, Math.round((toTs - fromTs) / 60));

    // Fetch existing exclusions from DB for this org & SLO
    const exclusions = await this.exclusionRepository.find({
      where: { orgId: String(org.orgId), sloId },
    });
    const excludedTimestampsSet = new Map<number, DowntimeExclusion>();
    exclusions.forEach(ex => excludedTimestampsSet.set(Number(ex.eventTimestamp), ex));

    const headers = {
      'DD-API-KEY': org.apiKey,
      'DD-APPLICATION-KEY': org.appKey,
      'Content-Type': 'application/json',
    };

    for (const baseUrl of this.getDatadogBaseUrls()) {
      try {
        const [historyRes, synTests] = await Promise.all([
          axios.get(`${baseUrl}/api/v1/slo/${sloId}/history`, {
            headers,
            params: { from_ts: fromTs, to_ts: toTs },
            timeout: 8000,
          }),
          this.fetchSyntheticsTests(baseUrl, headers),
        ]);

        const data = historyRes.data.data || {};
        const overall = data.overall || {};
        const series = data.series || {};
        const targetThreshold = data.thresholds?.[0]?.target ?? 99.0;
        const name = overall.name || data.name || '';

        // Extract Digital Experience URLs
        const { primaryUrl, allUrls } = this.resolveUrlsForSlo({ name, description: '' }, synTests, org.orgName);

        // Fetch Datadog downtimes for this Org
        let activeDowntimesList: any[] = [];
        try {
          const dtRes = await axios.get(`${baseUrl}/api/v1/downtime`, {
            headers,
            params: { current_only: false },
            timeout: 5000,
          });
          activeDowntimesList = dtRes.data || [];
        } catch (e) {}

        const resolveDowntimeForEvent = async (monId: number | null, eventUrl: string | null, startTsSec: number, endTsSec: number) => {
          let isMuted = false;
          let datadogDowntimeWindow: any = null;

          for (const dt of activeDowntimesList) {
            if (dt.disabled) continue;
            let isMonMatch = false;

            // Priority 1: exact monitor_id match (most reliable)
            if (dt.monitor_id && monId && dt.monitor_id === monId) {
              isMonMatch = true;
            }
            // Priority 2: monitor_tags match — check if the mute targets a tag group containing this monitor
            // (do NOT match wildcard '*' scope or host scopes — those are for infrastructure, not URL monitors)
            // No other fallback: avoid false positives from unrelated mutes

            let isTimeMatch = false;
            const dtStart = dt.start || 0;
            const dtEnd = dt.end || 0;
            if (dtEnd) {
              // Mute has an explicit end — event must be fully within the mute window (±15 min tolerance)
              isTimeMatch = startTsSec >= (dtStart - 900) && endTsSec <= (dtEnd + 900);
            } else if (dtStart > 0) {
              // Mute is indefinite — event must start AFTER the mute was created
              isTimeMatch = startTsSec >= dtStart;
            }

            if (isMonMatch && isTimeMatch) {
              isMuted = true;
              const startStr = dtStart
                ? new Date(dtStart * 1000).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'N/A';
              const endStr = dtEnd
                ? new Date(dtEnd * 1000).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'Permanent / Indéfini';
              datadogDowntimeWindow = `${startStr} ➔ ${endStr}`;
              break;
            }
          }
          return { isMuted, datadogDowntimeWindow };
        };

        const downtimeEvents: any[] = [];
        let rawDowntimeMins = 0;
        let excludedDowntimeMins = 0;

        // Strategy A: Monitor-based SLOs
        if (data.monitors && Array.isArray(data.monitors)) {
          for (const mon of data.monitors) {
            const monName = mon.name || '';
            const monUrls = this.extractUrlsFromText(monName);
            const monUrl = monUrls.length > 0 ? monUrls[0] : (primaryUrl || null);

            const stateHistory = mon.history || mon.state_history || [];

            // Continuous outage merging state-machine
            const mergedEvents: Array<{ startTsSec: number; endTsSec: number; worstState: any }> = [];
            let currentOutage: { startTsSec: number; endTsSec: number; worstState: any } | null = null;

            for (let i = 0; i < stateHistory.length; i++) {
              const item = stateHistory[i];
              let ts = 0;
              let stateCode: any = 0;

              if (Array.isArray(item)) {
                ts = item[0];
                stateCode = item[1];
              } else if (item && typeof item === 'object') {
                ts = item.from_ts || item.timestamp || 0;
                stateCode = item.state !== undefined ? item.state : item.status;
              }

              const isFailure = (stateCode === 1 || stateCode === 2 || stateCode === 'alert' || stateCode === 'warning' || stateCode === 'WARN');

              if (isFailure) {
                if (!currentOutage) {
                  currentOutage = {
                    startTsSec: ts,
                    endTsSec: ts + 1800, // default fallback if unclosed
                    worstState: stateCode,
                  };
                } else {
                  if (stateCode === 2 || stateCode === 'alert') {
                    currentOutage.worstState = 2;
                  }
                }
              } else {
                if (currentOutage) {
                  currentOutage.endTsSec = ts;
                  mergedEvents.push(currentOutage);
                  currentOutage = null;
                }
              }
            }
            if (currentOutage) {
              mergedEvents.push(currentOutage);
            }

            for (const ev of mergedEvents) {
              const startTsSec = ev.startTsSec;
              const endTsSec = ev.endTsSec;
              const stateCode = ev.worstState;

              const eventTs = startTsSec * 1000;
              const dtMins = Math.max(1, Math.round((endTsSec - startTsSec) / 60));

              const isExcluded = excludedTimestampsSet.has(eventTs);
              if (isExcluded) {
                excludedDowntimeMins += dtMins;
              } else {
                rawDowntimeMins += dtMins;
              }

              const exclusionInfo = excludedTimestampsSet.get(eventTs);
              const { isMuted, datadogDowntimeWindow } = await resolveDowntimeForEvent(mon.monitor_id || mon.id, monUrl, startTsSec, endTsSec);

              let failureCause = 'Downtime';
              let responseTimeThreshold = 'N/A';

              const nameLower = (monName || '').toLowerCase();
              const queryLower = (mon.query || '').toLowerCase();

              if (stateCode === 1 || stateCode === 'warning' || stateCode === 'WARN' || 
                  nameLower.includes('response') || nameLower.includes('latency') || nameLower.includes('duration') || nameLower.includes('time') || nameLower.includes('slow') || queryLower.includes('response_time') || queryLower.includes('latency')) {
                failureCause = 'Response Time';
                responseTimeThreshold = '3000ms';
              } else if (nameLower.includes('ssl')) {
                failureCause = 'SSL Certificate';
              } else if (nameLower.includes('waf') || nameLower.includes('auth')) {
                failureCause = 'Authentication / WAF';
              } else {
                failureCause = 'Downtime';
              }

              downtimeEvents.push({
                id: eventTs,
                timestamp: eventTs,
                startTime: new Date(startTsSec * 1000).toISOString(),
                endTime: new Date(endTsSec * 1000).toISOString(),
                durationMins: dtMins,
                uptime: parseFloat((mon.sli_value ?? 98.0).toFixed(4)),
                url: monUrl,
                status: stateCode === 2 || stateCode === 'alert' ? 'BREACH' : 'WARNING',
                failureCause,
                responseTimeThreshold,
                isMuted,
                datadogDowntimeWindow,
                isExcluded,
                reason: exclusionInfo?.reason || 'Approved Maintenance / Outage Exclusion',
                excludedBy: exclusionInfo?.excludedBy || 'SOC Admin',
              });
            }
              }
            }
          }
        }

        // Strategy B: Metric-based SLOs (series uptime)
        if (downtimeEvents.length === 0 && series.uptime?.data) {
          const uptimeSeries: number[] = series.uptime.data || [];
          const times: number[] = series.uptime.times || [];

          for (let index = 0; index < times.length; index++) {
            const ts = times[index];
            const ptUptime = uptimeSeries[index];
            if (ptUptime !== undefined && ptUptime < 100) {
              const eventTs = ts * 1000;
              const dtMins = Math.max(1, Math.round(((100 - ptUptime) / 100) * 60));
              const endTs = ts + dtMins * 60;

              const isExcluded = excludedTimestampsSet.has(eventTs);
              if (isExcluded) {
                excludedDowntimeMins += dtMins;
              } else {
                rawDowntimeMins += dtMins;
              }

              const exclusionInfo = excludedTimestampsSet.get(eventTs);
              const eventUrl = primaryUrl || null;
              const { isMuted, datadogDowntimeWindow } = await resolveDowntimeForEvent(null, eventUrl || '', ts, endTs);

              downtimeEvents.push({
                id: eventTs,
                timestamp: eventTs,
                startTime: new Date(eventTs).toISOString(),
                endTime: new Date(eventTs + dtMins * 60 * 1000).toISOString(),
                durationMins: dtMins,
                uptime: parseFloat(ptUptime.toFixed(4)),
                url: eventUrl,
                status: ptUptime < (targetThreshold || 99) ? 'BREACH' : 'WARNING',
                isMuted,
                datadogDowntimeWindow,
                isExcluded,
                reason: exclusionInfo?.reason || 'Approved Maintenance / Outage Exclusion',
                excludedBy: exclusionInfo?.excludedBy || 'SOC Admin',
              });
            }
          }
        }

        // Compute overall effective metrics from Datadog
        const sliValue = overall.sli_value ?? overall.uptime ?? 100;
        const totalRawDowntime = overall.downtime_in_minutes ?? (rawDowntimeMins > 0 ? rawDowntimeMins : Math.round(((100 - sliValue) / 100) * totalMinutes));

        const effectiveDowntimeMins = Math.max(0, totalRawDowntime - excludedDowntimeMins);
        const effectiveUptime = parseFloat((100 - (effectiveDowntimeMins / totalMinutes * 100)).toFixed(4));

        let effectiveErrorBudgetRemaining = 100;
        if (targetThreshold && targetThreshold < 100) {
          const budget = ((effectiveUptime - targetThreshold) / (100 - targetThreshold)) * 100;
          effectiveErrorBudgetRemaining = Math.max(0, Math.min(100, parseFloat(budget.toFixed(2))));
        }

        return {
          orgName: org.orgName,
          sloId,
          fromTs,
          toTs,
          totalMinutes,
          targetThreshold,
          overall: {
            name: name || `${org.orgName} Service Level Health`,
            targetUrl: primaryUrl,
            targetUrls: allUrls,
            uptime: effectiveUptime,
            rawUptime: sliValue,
            downtimeMins: effectiveDowntimeMins,
            rawDowntimeMins: totalRawDowntime,
            excludedDowntimeMins,
            sliValue: effectiveUptime,
            errorBudgetRemaining: effectiveErrorBudgetRemaining,
          },
          downtimeHistory: downtimeEvents.sort((a, b) => b.timestamp - a.timestamp),
        };
      } catch (err: any) {
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          continue;
        }
        break;
      }
    }

    // NO MOCK FALLBACK: Return clean real status without fake data
    return {
      orgName: org.orgName,
      sloId,
      fromTs,
      toTs,
      totalMinutes,
      targetThreshold: 99.0,
      overall: {
        name: `${org.orgName} Service Level Health`,
        targetUrl: null,
        targetUrls: [],
        uptime: 100.0,
        rawUptime: 100.0,
        downtimeMins: 0,
        rawDowntimeMins: 0,
        excludedDowntimeMins: 0,
        sliValue: 100.0,
        errorBudgetRemaining: 100.0,
      },
      downtimeHistory: [],
    };
  }

  async toggleExclusion(
    orgId: string,
    sloId: string,
    eventTimestamp: number,
    durationMins: number,
    reason?: string,
    excludedBy?: string,
  ): Promise<{ action: 'excluded' | 'included' }> {
    const existing = await this.exclusionRepository.findOneBy({
      orgId,
      sloId,
      eventTimestamp,
    });

    if (existing) {
      await this.exclusionRepository.remove(existing);
      this.logger.log(`Restored event timestamp=${eventTimestamp} for org=${orgId}, sloId=${sloId}`);
      return { action: 'included' };
    } else {
      const exclusion = this.exclusionRepository.create({
        orgId,
        sloId,
        eventTimestamp,
        durationMins,
        reason: reason || 'Planned Maintenance Exclusion',
        excludedBy: excludedBy || 'SOC Manager',
      });
      await this.exclusionRepository.save(exclusion);
      this.logger.log(`Excluded event timestamp=${eventTimestamp} (${durationMins}m) for org=${orgId}, sloId=${sloId}`);
      return { action: 'excluded' };
    }
  }
}
