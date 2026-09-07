import type { APIRoute } from 'astro';
import { isAdminAuthenticated } from '../../../lib/auth';
import { toggleItemStatus, pruneInactiveItems, logSystemEvent } from '../../../lib/db';
import { runIngestion } from '../../../../scripts/ingest';
import { runLinkRotChecker } from '../../../../scripts/check-rot';
import { scrapeAndUploadCatalog } from '../../../lib/scraper';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!isAdminAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const formData = await request.formData();
  const action = formData.get('action')?.toString();

  try {
    if (action === 'toggle-item') {
      const id = parseInt(formData.get('id')?.toString() || '0', 10);
      if (id > 0) {
        toggleItemStatus(id);
      }
    } else if (action === 'prune-inactive') {
      pruneInactiveItems();
    } else if (action === 'run-ingestion') {
      await runIngestion();
    } else if (action === 'run-rot-check') {
      await runLinkRotChecker();
    } else if (action === 'run-scraper') {
      const limit = parseInt(formData.get('limit')?.toString() || '4', 10);
      await scrapeAndUploadCatalog({ maxPerCategory: limit });
    } else if (action === 'scrape-query') {
      const query = formData.get('query')?.toString()?.trim();
      const limit = parseInt(formData.get('limit')?.toString() || '5', 10);
      if (query) {
        await scrapeAndUploadCatalog({ customQuery: query, maxPerCategory: limit });
      }
    } else if (action === 'scrape-asins') {
      const asinsRaw = formData.get('asins')?.toString() || '';
      const asins = asinsRaw
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s.length === 10);
      if (asins.length > 0) {
        await scrapeAndUploadCatalog({ customAsins: asins });
      }
    } else if (action === 'run-audit') {
      const prune = formData.get('prune')?.toString() === 'true';
      const { runCatalogAudit } = await import('../../../../scripts/audit-catalog');
      await runCatalogAudit({ pruneDeleted: prune });
    }

    return redirect('/admin?status=success', 302);
  } catch (err: any) {
    console.error('Admin action failed:', err);
    logSystemEvent('admin_action_error', 'error', `${action} failed: ${err.message}`);
    return redirect(`/admin?status=error&msg=${encodeURIComponent(err.message)}`, 302);
  }
};
