/**
 * hMailServer Email Admin service - HTTP client to the .NET bridge.
 */

const BRIDGE_URL = process.env.HMALL_BRIDGE_URL || 'http://127.0.0.1:5099';
const BRIDGE_API_KEY = process.env.HMALL_BRIDGE_API_KEY || 'change-me-secure-api-key';

async function bridgeFetch(
  method: string,
  path: string,
  body?: unknown
): Promise<{ data?: unknown; error?: string }> {
  const url = `${BRIDGE_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    'X-Api-Key': BRIDGE_API_KEY,
    Accept: 'application/json',
  };
  if (body != null) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error';
    const isUnreachable = /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|fetch failed|Failed to fetch/i.test(msg);
    return { error: isUnreachable ? 'Email Admin service unavailable. Ensure the hMailServer bridge is running.' : msg };
  }

  const json = await res.json().catch(() => ({})) as { data?: unknown; error?: string };
  if (!res.ok) {
    return { error: json.error || `Bridge returned ${res.status}` };
  }
  return json;
}

export interface Domain {
  id: number;
  name: string;
  active: boolean;
}

export interface Account {
  id: number;
  address: string;
  active: boolean;
  maxSize: number;
  personFirstName: string;
  personLastName: string;
}

export interface Alias {
  id: number;
  name: string;
  value: string;
  active: boolean;
}

export interface DistributionList {
  id: number;
  address: string;
  active: boolean;
}

function mapDomain(d: { Id?: number; Name?: string; Active?: boolean; id?: number; name?: string; active?: boolean }): Domain {
  return { id: d.Id ?? d.id ?? 0, name: (d.Name ?? d.name ?? ''), active: !!(d.Active ?? d.active) };
}

function mapAccount(a: { Id?: number; Address?: string; Active?: boolean; MaxSize?: number; PersonFirstName?: string; PersonLastName?: string; id?: number; address?: string; active?: boolean; maxSize?: number; personFirstName?: string; personLastName?: string }): Account {
  return {
    id: a.Id ?? a.id ?? 0,
    address: (a.Address ?? a.address ?? ''),
    active: !!(a.Active ?? a.active),
    maxSize: a.MaxSize ?? a.maxSize ?? 0,
    personFirstName: (a.PersonFirstName ?? a.personFirstName ?? ''),
    personLastName: (a.PersonLastName ?? a.personLastName ?? ''),
  };
}

function mapAlias(a: { Id?: number; Name?: string; Value?: string; Active?: boolean; id?: number; name?: string; value?: string; active?: boolean }): Alias {
  return { id: a.Id ?? a.id ?? 0, name: (a.Name ?? a.name ?? ''), value: (a.Value ?? a.value ?? ''), active: !!(a.Active ?? a.active) };
}

function mapDl(d: { Id?: number; Address?: string; Active?: boolean; id?: number; address?: string; active?: boolean }): DistributionList {
  return { id: d.Id ?? d.id ?? 0, address: (d.Address ?? d.address ?? ''), active: !!(d.Active ?? d.active) };
}

/** All active account + distribution list addresses for Compose TO/CC/BCC autocomplete. */
export async function listRecipients(): Promise<{ data?: string[]; error?: string }> {
  const out = await bridgeFetch('GET', '/recipients');
  if (out.error) return { error: out.error };
  const list = Array.isArray(out.data) ? out.data : (out.data as { data?: string[] })?.data ?? [];
  return { data: list };
}

export async function listDomains(): Promise<{ data?: Domain[]; error?: string }> {
  const out = await bridgeFetch('GET', '/domains');
  if (out.error) return { error: out.error };
  const list = Array.isArray(out.data) ? out.data : (out.data as { data?: unknown[] })?.data ?? [];
  return { data: list.map((d: Record<string, unknown>) => mapDomain(d as Parameters<typeof mapDomain>[0])) };
}

export async function createDomain(name: string, active = true): Promise<{ data?: Domain; error?: string }> {
  const out = await bridgeFetch('POST', '/domains', { Name: name, Active: active });
  if (out.error) return { error: out.error };
  const d = (out.data as { data?: { Id?: number; Name?: string; Active?: boolean } })?.data ?? (out.data as { Id?: number; Name?: string; Active?: boolean });
  return { data: mapDomain(d) };
}

export async function updateDomain(id: number, payload: { name?: string; active?: boolean }): Promise<{ error?: string }> {
  const out = await bridgeFetch('PUT', `/domains/${id}`, { Name: payload.name, Active: payload.active });
  return out.error ? out : {};
}

export async function deleteDomain(id: number): Promise<{ error?: string }> {
  const out = await bridgeFetch('DELETE', `/domains/${id}`);
  return out.error ? out : {};
}

export async function listAccounts(domainId: number): Promise<{ data?: Account[]; error?: string }> {
  const out = await bridgeFetch('GET', `/domains/${domainId}/accounts`);
  if (out.error) return { error: out.error };
  const list = (out.data as { data?: unknown[] })?.data ?? (Array.isArray(out.data) ? out.data : []);
  return { data: list.map((a: { Id?: number; Address?: string; Active?: boolean; MaxSize?: number; PersonFirstName?: string; PersonLastName?: string }) => mapAccount(a)) };
}

export async function createAccount(
  domainId: number,
  address: string,
  password: string,
  active = true,
  maxSize = 100
): Promise<{ data?: Account; error?: string }> {
  const out = await bridgeFetch('POST', `/domains/${domainId}/accounts`, {
    Address: address,
    Password: password,
    Active: active,
    MaxSize: maxSize,
  });
  if (out.error) return { error: out.error };
  const d = (out.data as { data?: unknown })?.data ?? out.data;
  return { data: mapAccount(d as { Id?: number; Address?: string; Active?: boolean; MaxSize?: number; PersonFirstName?: string; PersonLastName?: string }) };
}

export async function updateAccount(
  id: number,
  payload: { personFirstName?: string; personLastName?: string; active?: boolean; maxSize?: number }
): Promise<{ error?: string }> {
  const out = await bridgeFetch('PUT', `/accounts/${id}`, {
    PersonFirstName: payload.personFirstName,
    PersonLastName: payload.personLastName,
    Active: payload.active,
    MaxSize: payload.maxSize,
  });
  return out.error ? out : {};
}

export async function changeAccountPassword(id: number, password: string): Promise<{ error?: string }> {
  const out = await bridgeFetch('PUT', `/accounts/${id}/password`, { Password: password });
  return out.error ? out : {};
}

export async function deleteAccount(id: number): Promise<{ error?: string }> {
  const out = await bridgeFetch('DELETE', `/accounts/${id}`);
  return out.error ? out : {};
}

export async function listAliases(domainId: number): Promise<{ data?: Alias[]; error?: string }> {
  const out = await bridgeFetch('GET', `/domains/${domainId}/aliases`);
  if (out.error) return { error: out.error };
  const list = (out.data as { data?: unknown[] })?.data ?? (Array.isArray(out.data) ? out.data : []);
  return { data: list.map((a: { Id?: number; Name?: string; Value?: string; Active?: boolean }) => mapAlias(a)) };
}

export async function createAlias(
  domainId: number,
  name: string,
  value: string,
  active = true
): Promise<{ data?: Alias; error?: string }> {
  const out = await bridgeFetch('POST', `/domains/${domainId}/aliases`, { Name: name, Value: value, Active: active });
  if (out.error) return { error: out.error };
  const d = (out.data as { data?: unknown })?.data ?? out.data;
  return { data: mapAlias(d as { Id?: number; Name?: string; Value?: string; Active?: boolean }) };
}

export async function updateAlias(
  id: number,
  payload: { name?: string; value?: string; active?: boolean }
): Promise<{ error?: string }> {
  const out = await bridgeFetch('PUT', `/aliases/${id}`, {
    Name: payload.name,
    Value: payload.value,
    Active: payload.active,
  });
  return out.error ? out : {};
}

export async function deleteAlias(id: number): Promise<{ error?: string }> {
  const out = await bridgeFetch('DELETE', `/aliases/${id}`);
  return out.error ? out : {};
}

export async function listDistributionLists(domainId: number): Promise<{ data?: DistributionList[]; error?: string }> {
  const out = await bridgeFetch('GET', `/domains/${domainId}/distributionlists`);
  if (out.error) return { error: out.error };
  const list = (out.data as { data?: unknown[] })?.data ?? (Array.isArray(out.data) ? out.data : []);
  return { data: list.map((d: { Id?: number; Address?: string; Active?: boolean }) => mapDl(d)) };
}

export async function createDistributionList(
  domainId: number,
  address: string,
  active = true
): Promise<{ data?: DistributionList; error?: string }> {
  const out = await bridgeFetch('POST', `/domains/${domainId}/distributionlists`, { Address: address, Active: active });
  if (out.error) return { error: out.error };
  const d = (out.data as { data?: unknown })?.data ?? out.data;
  return { data: mapDl(d as { Id?: number; Address?: string; Active?: boolean }) };
}

export async function updateDistributionList(
  id: number,
  payload: { address?: string; active?: boolean }
): Promise<{ error?: string }> {
  const out = await bridgeFetch('PUT', `/distributionlists/${id}`, { Address: payload.address, Active: payload.active });
  return out.error ? out : {};
}

export async function deleteDistributionList(id: number): Promise<{ error?: string }> {
  const out = await bridgeFetch('DELETE', `/distributionlists/${id}`);
  return out.error ? out : {};
}

export async function listDistributionListRecipients(id: number): Promise<{ data?: string[]; error?: string }> {
  const out = await bridgeFetch('GET', `/distributionlists/${id}/recipients`);
  if (out.error) return { error: out.error };
  const list = (out.data as { data?: string[] })?.data ?? (Array.isArray(out.data) ? out.data : []);
  return { data: list };
}

export async function addDistributionListRecipient(id: number, address: string): Promise<{ error?: string }> {
  const out = await bridgeFetch('POST', `/distributionlists/${id}/recipients`, { Address: address });
  return out.error ? out : {};
}

export async function removeDistributionListRecipient(id: number, address: string): Promise<{ error?: string }> {
  const enc = encodeURIComponent(address);
  const out = await bridgeFetch('DELETE', `/distributionlists/${id}/recipients/${enc}`);
  return out.error ? out : {};
}
