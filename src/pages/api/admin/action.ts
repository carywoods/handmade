import type { APIRoute } from 'astro';
import { isAdminAuthenticated } from '../../../lib/auth';
import { toggleItemStatus, pruneInactiveItems, logSystemEvent } from '../../../lib/db';
import { runIngestion } from '../../../../scripts/ingest';
import { runLinkRotChecker } from '../../../../scripts/check-rot';

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
    }

    return redirect('/admin?status=success', 302);
  } catch (err: any) {
    console.error('Admin action failed:', err);
    logSystemEvent('admin_action_error', 'error', `${action} failed: ${err.message}`);
    return redirect(`/admin?status=error&msg=${encodeURIComponent(err.message)}`, 302);
  }
};
