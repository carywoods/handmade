import type { APIRoute } from 'astro';
import { isAdminAuthenticated } from '../../../lib/auth';
import { toggleItemStatus, pruneInactiveItems, logSystemEvent } from '../../../lib/db';
import { runIngestion } from '../../../../scripts/ingest';
import { runLinkRotChecker } from '../../../../scripts/check-rot';
import { scrapeAndUploadCatalog } from '../../../lib/scraper';
import { seed } from '../../../../scripts/seed';

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
    } else if (action === 'sync-catalog' || action === 'seed-catalog') {
      seed();
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
    } else if (action === 'validate-asin') {
      const input = formData.get('asin')?.toString() || '';
      const { verifyAsinLive, extractAsin } = await import('../../../lib/asin');
      const { getItemByAsin } = await import('../../../lib/db');

      const extractedAsin = extractAsin(input);
      if (!extractedAsin) {
        return new Response(
          JSON.stringify({
            valid: false,
            exists: false,
            asin: input,
            reason: 'Invalid ASIN format. Must be a 10-character alphanumeric string or valid Amazon product URL.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const existing = getItemByAsin(extractedAsin);
      const liveCheck = await verifyAsinLive(extractedAsin);

      return new Response(
        JSON.stringify({
          valid: liveCheck.valid,
          exists: liveCheck.exists,
          asin: extractedAsin,
          inDatabase: Boolean(existing),
          dbItem: existing
            ? {
                title: existing.title,
                category: existing.category,
                is_active: Boolean(existing.is_active),
                artisan_name: existing.artisan_name,
              }
            : null,
          title: liveCheck.title || existing?.title,
          reason: liveCheck.reason,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else if (action === 'scrape-asins') {
      const asinsRaw = formData.get('asins')?.toString() || '';
      const { parseAsinList } = await import('../../../lib/asin');
      const { valid, invalid } = parseAsinList(asinsRaw);

      if (valid.length === 0) {
        throw new Error(
          `No valid 10-character ASINs found in input "${asinsRaw.slice(0, 40)}...". Please provide valid ASINs or Amazon product URLs.`
        );
      }

      await scrapeAndUploadCatalog({ customAsins: valid });

      if (invalid.length > 0) {
        logSystemEvent(
          'admin_asins_warning',
          'warning',
          `Ingested ${valid.length} valid ASINs. Ignored ${invalid.length} invalid entries: ${invalid.join(', ')}`
        );
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
