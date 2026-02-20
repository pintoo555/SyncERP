/**
 * Client Dashboard analytics: aggregation queries for KPIs, charts, and geographic distribution.
 * Uses SQL Server 2008-compatible syntax (no FORMAT / STRING_SPLIT).
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';

const SCHEMA = config.db.schema || 'dbo';
const CLIENT = `[${SCHEMA}].[utbl_Client]`;
const ADDRESS = `[${SCHEMA}].[utbl_ClientAddress]`;
const CONTACT = `[${SCHEMA}].[utbl_ClientContact]`;
const STATE = `[${SCHEMA}].[utbl_State]`;
const COUNTRY = `[${SCHEMA}].[utbl_Country]`;
const INDUSTRY = `[${SCHEMA}].[utbl_Industry]`;
const GROUP = `[${SCHEMA}].[utbl_ClientGroup]`;
const GROUP_MEMBER = `[${SCHEMA}].[utbl_ClientGroupMember]`;

export interface ClientDashboardStats {
  kpis: {
    totalClients: number;
    activeClients: number;
    blacklistedClients: number;
    mergedClients: number;
    gstVerified: number;
    totalContacts: number;
    whatsAppVerified: number;
    totalGroups: number;
  };
  byType: { name: string; value: number }[];
  byIndustry: { name: string; value: number }[];
  byState: { stateCode: string; stateName: string; value: number }[];
  byCity: { city: string; state: string; value: number }[];
  growthByMonth: { month: string; count: number }[];
  recentClients: { id: number; clientCode: string; clientName: string; clientType: string; industryName: string | null; createdOn: string; isActive: boolean }[];
  topStates: { stateName: string; clientCount: number; contactCount: number }[];
  creditSummary: { avgCreditLimit: number; avgCreditDays: number; totalCreditLimit: number };
  contactRoleDist: { role: string; count: number }[];
}

export async function getDashboardStats(): Promise<ClientDashboardStats> {
  const [
    kpiResult,
    byTypeResult,
    byIndustryResult,
    byStateResult,
    byCityResult,
    growthResult,
    recentResult,
    topStatesResult,
    creditResult,
    contactRoleResult,
  ] = await Promise.all([
    // KPIs
    (await getRequest()).query(`
      SELECT
        COUNT(*) AS totalClients,
        SUM(CASE WHEN IsActive = 1 AND IsMerged = 0 THEN 1 ELSE 0 END) AS activeClients,
        SUM(CASE WHEN IsBlacklisted = 1 THEN 1 ELSE 0 END) AS blacklistedClients,
        SUM(CASE WHEN IsMerged = 1 THEN 1 ELSE 0 END) AS mergedClients,
        SUM(CASE WHEN GSTVerified = 1 THEN 1 ELSE 0 END) AS gstVerified,
        (SELECT COUNT(*) FROM ${CONTACT} WHERE IsActive = 1) AS totalContacts,
        (SELECT COUNT(*) FROM ${CONTACT} WHERE WhatsAppVerified = 1 AND IsActive = 1) AS whatsAppVerified,
        (SELECT COUNT(*) FROM ${GROUP} WHERE IsActive = 1) AS totalGroups
      FROM ${CLIENT}
    `),

    // By client type
    (await getRequest()).query(`
      SELECT ClientType AS name, COUNT(*) AS value
      FROM ${CLIENT} WHERE IsActive = 1 AND IsMerged = 0
      GROUP BY ClientType ORDER BY value DESC
    `),

    // By industry (top 10)
    (await getRequest()).query(`
      SELECT TOP 10 ISNULL(i.IndustryName, 'Unassigned') AS name, COUNT(*) AS value
      FROM ${CLIENT} c LEFT JOIN ${INDUSTRY} i ON i.Id = c.IndustryId
      WHERE c.IsActive = 1 AND c.IsMerged = 0
      GROUP BY i.IndustryName ORDER BY value DESC
    `),

    // By state (for India map)
    (await getRequest()).query(`
      SELECT s.StateCode AS stateCode, s.StateName AS stateName, COUNT(DISTINCT a.ClientId) AS value
      FROM ${ADDRESS} a
      INNER JOIN ${STATE} s ON s.Id = a.StateId
      INNER JOIN ${COUNTRY} co ON co.Id = s.CountryId AND co.CountryCode = 'IN'
      INNER JOIN ${CLIENT} cl ON cl.Id = a.ClientId AND cl.IsActive = 1 AND cl.IsMerged = 0
      WHERE a.IsActive = 1
      GROUP BY s.StateCode, s.StateName
      ORDER BY value DESC
    `),

    // By city (top 15)
    (await getRequest()).query(`
      SELECT TOP 15 ISNULL(a.City, 'Unknown') AS city, ISNULL(s.StateName, '') AS state, COUNT(DISTINCT a.ClientId) AS value
      FROM ${ADDRESS} a
      LEFT JOIN ${STATE} s ON s.Id = a.StateId
      INNER JOIN ${CLIENT} cl ON cl.Id = a.ClientId AND cl.IsActive = 1 AND cl.IsMerged = 0
      WHERE a.IsActive = 1 AND a.City IS NOT NULL AND a.City <> ''
      GROUP BY a.City, s.StateName
      ORDER BY value DESC
    `),

    // Growth by month (last 12 months)
    (await getRequest()).query(`
      SELECT
        CAST(YEAR(c.CreatedOn) AS VARCHAR(4)) + '-' + RIGHT('0' + CAST(MONTH(c.CreatedOn) AS VARCHAR(2)), 2) AS month,
        COUNT(*) AS count
      FROM ${CLIENT} c
      WHERE c.CreatedOn >= DATEADD(month, -12, GETDATE())
      GROUP BY YEAR(c.CreatedOn), MONTH(c.CreatedOn)
      ORDER BY YEAR(c.CreatedOn), MONTH(c.CreatedOn)
    `),

    // Recent 10 clients
    (await getRequest()).query(`
      SELECT TOP 10 c.Id AS id, c.ClientCode AS clientCode, c.ClientName AS clientName,
        c.ClientType AS clientType, i.IndustryName AS industryName,
        c.CreatedOn AS createdOn, c.IsActive AS isActive
      FROM ${CLIENT} c LEFT JOIN ${INDUSTRY} i ON i.Id = c.IndustryId
      ORDER BY c.CreatedOn DESC
    `),

    // Top states by client + contact count
    (await getRequest()).query(`
      SELECT TOP 10 s.StateName AS stateName,
        COUNT(DISTINCT a.ClientId) AS clientCount,
        (SELECT COUNT(*) FROM ${CONTACT} ct WHERE ct.IsActive = 1 AND ct.ClientId IN (
          SELECT a2.ClientId FROM ${ADDRESS} a2 WHERE a2.StateId = s.Id AND a2.IsActive = 1
        )) AS contactCount
      FROM ${ADDRESS} a
      INNER JOIN ${STATE} s ON s.Id = a.StateId
      INNER JOIN ${CLIENT} cl ON cl.Id = a.ClientId AND cl.IsActive = 1 AND cl.IsMerged = 0
      WHERE a.IsActive = 1
      GROUP BY s.Id, s.StateName
      ORDER BY clientCount DESC
    `),

    // Credit summary
    (await getRequest()).query(`
      SELECT
        ISNULL(AVG(CASE WHEN CreditLimit > 0 THEN CreditLimit END), 0) AS avgCreditLimit,
        ISNULL(AVG(CASE WHEN CreditDays > 0 THEN CreditDays END), 0) AS avgCreditDays,
        ISNULL(SUM(CreditLimit), 0) AS totalCreditLimit
      FROM ${CLIENT} WHERE IsActive = 1 AND IsMerged = 0
    `),

    // Contact role distribution
    (await getRequest()).query(`
      SELECT LTRIM(RTRIM(r.value)) AS role, COUNT(*) AS count
      FROM ${CONTACT} c
      CROSS APPLY (
        SELECT x.i.value('.', 'VARCHAR(200)') AS value
        FROM (SELECT CAST('<r><i>' + REPLACE(c.ContactRoles, ',', '</i><i>') + '</i></r>' AS XML) AS xmlData) AS d
        CROSS APPLY d.xmlData.nodes('/r/i') AS x(i)
      ) r
      WHERE c.IsActive = 1 AND c.ContactRoles IS NOT NULL AND c.ContactRoles <> ''
      GROUP BY LTRIM(RTRIM(r.value)) ORDER BY count DESC
    `),
  ]);

  const kpi = kpiResult.recordset[0] || {};

  return {
    kpis: {
      totalClients: kpi.totalClients ?? 0,
      activeClients: kpi.activeClients ?? 0,
      blacklistedClients: kpi.blacklistedClients ?? 0,
      mergedClients: kpi.mergedClients ?? 0,
      gstVerified: kpi.gstVerified ?? 0,
      totalContacts: kpi.totalContacts ?? 0,
      whatsAppVerified: kpi.whatsAppVerified ?? 0,
      totalGroups: kpi.totalGroups ?? 0,
    },
    byType: (byTypeResult.recordset || []).map((r: any) => ({ name: r.name, value: r.value })),
    byIndustry: (byIndustryResult.recordset || []).map((r: any) => ({ name: r.name, value: r.value })),
    byState: (byStateResult.recordset || []).map((r: any) => ({ stateCode: r.stateCode, stateName: r.stateName, value: r.value })),
    byCity: (byCityResult.recordset || []).map((r: any) => ({ city: r.city, state: r.state, value: r.value })),
    growthByMonth: (growthResult.recordset || []).map((r: any) => ({ month: r.month, count: r.count })),
    recentClients: (recentResult.recordset || []).map((r: any) => ({
      id: r.id, clientCode: r.clientCode, clientName: r.clientName,
      clientType: r.clientType, industryName: r.industryName ?? null,
      createdOn: r.createdOn instanceof Date ? r.createdOn.toISOString() : String(r.createdOn),
      isActive: !!r.isActive,
    })),
    topStates: (topStatesResult.recordset || []).map((r: any) => ({
      stateName: r.stateName, clientCount: r.clientCount, contactCount: r.contactCount,
    })),
    creditSummary: {
      avgCreditLimit: Math.round(creditResult.recordset[0]?.avgCreditLimit ?? 0),
      avgCreditDays: Math.round(creditResult.recordset[0]?.avgCreditDays ?? 0),
      totalCreditLimit: Math.round(creditResult.recordset[0]?.totalCreditLimit ?? 0),
    },
    contactRoleDist: (contactRoleResult.recordset || []).map((r: any) => ({ role: r.role?.trim(), count: r.count })).filter((r: any) => r.role),
  };
}
