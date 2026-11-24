/**
 * MAHI Platform V2 — Enterprise Web Admin Portal HTML (Facade)
 * Served on http://127.0.0.1:32123/admin
 */

import { getWebAdminTemplateHtml } from './templates/web-admin.template.js';
import { getOwnerAdminTemplateHtml } from './templates/owner-admin.template.js';

export function getWebAdminHtml(): string {
  return getWebAdminTemplateHtml();
}

export function getOwnerAdminHtml(): string {
  return getOwnerAdminTemplateHtml();
}
