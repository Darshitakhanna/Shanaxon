import { TenantContext, WorkspaceConfig } from '../types';

/**
 * Resolves the tenant context for the current execution session.
 * For local desktop / developer CLI runs, returns a default local context.
 */
export function resolveTenantContext(
  config?: Partial<WorkspaceConfig>,
  workspaceRoot?: string
): TenantContext {
  const tenantId = config?.tenantId || process.env.TOKENIST_TENANT_ID || 'local';
  const organizationId = config?.organizationId || process.env.TOKENIST_ORG_ID || 'default';
  const workspaceId = config?.workspaces?.[0] || workspaceRoot || process.cwd();

  return {
    tenantId,
    organizationId,
    workspaceId
  };
}

/**
 * Prefixes a cache or memory key with tenant isolation boundaries.
 * For default local single-user execution, returns the raw key un-modified
 * to guarantee total backward compatibility with existing cache files.
 */
export function scopedKey(rawKey: string, tenant: TenantContext): string {
  if (tenant.tenantId === 'local' && tenant.organizationId === 'default') {
    return rawKey;
  }
  return `tenant:${tenant.tenantId}:org:${tenant.organizationId}:${rawKey}`;
}
