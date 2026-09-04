import type { AuthScope } from './access.service.js';
import { listCompanyOptions } from './company.service.js';
import { relinkUnmatchedConvocations, syncGmailIntegration } from './gmail.service.js';
import { syncOutlookIntegration } from './outlook.service.js';

type SyncStats = {
  found: number;
  inserted: number;
  convocations: number;
};

const runningByScope = new Map<string, Promise<AccessibleEmailSyncResult>>();

export type AccessibleEmailSyncResult = {
  companies: number;
  found: number;
  inserted: number;
  convocations: number;
  reclassified: number;
  discarded: number;
  errors: number;
};

async function runAccessibleEmailSync(companyIds: string[]): Promise<AccessibleEmailSyncResult> {
  const result: AccessibleEmailSyncResult = {
    companies: companyIds.length,
    found: 0,
    inserted: 0,
    convocations: 0,
    reclassified: 0,
    discarded: 0,
    errors: 0
  };

  for (const companyId of companyIds) {
    const providers = await Promise.allSettled([
      syncGmailIntegration(companyId),
      syncOutlookIntegration(companyId)
    ]);
    for (const provider of providers) {
      if (provider.status === 'rejected') {
        result.errors += 1;
        continue;
      }
      const stats = provider.value as SyncStats;
      result.found += stats.found;
      result.inserted += stats.inserted;
      result.convocations += stats.convocations;
    }

    try {
      const review = await relinkUnmatchedConvocations(companyId);
      result.reclassified += review.reclassified;
      result.discarded += review.discarded;
    } catch {
      result.errors += 1;
    }
  }

  result.convocations += result.reclassified;
  return result;
}

export async function syncAccessibleEmailIntegrations(auth: AuthScope) {
  const companies = await listCompanyOptions(auth);
  const companyIds = companies.map((company) => company.id).sort();
  const scopeKey = companyIds.join(',') || `user:${auth.userId}`;
  const running = runningByScope.get(scopeKey);
  if (running) return running;

  const job = runAccessibleEmailSync(companyIds).finally(() => runningByScope.delete(scopeKey));
  runningByScope.set(scopeKey, job);
  return job;
}
