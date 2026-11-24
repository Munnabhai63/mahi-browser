/**
 * MAHI Platform V2 — Master Super Admin Console HTML (Facade)
 * Served on http://127.0.0.1:32123/super-admin
 */

import { getSuperAdminTemplateHtml } from './templates/super-admin.template.js';

export function getSuperAdminHtml(): string {
  return getSuperAdminTemplateHtml();
}
