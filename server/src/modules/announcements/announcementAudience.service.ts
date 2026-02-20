/**
 * Audience targeting engine: save targets and resolve to user IDs.
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type { AudienceTarget, AudienceRow } from './announcements.types';

const S = config.db.schema || 'dbo';
const AUDIENCE = `[${S}].[utbl_Announcements_Audience]`;

export async function saveAudience(announcementId: number, targets: AudienceTarget[]): Promise<void> {
  const delReq = await getRequest();
  delReq.input('annId', announcementId);
  await delReq.query(`DELETE FROM ${AUDIENCE} WHERE AnnouncementId = @annId`);

  for (const t of targets) {
    const req = await getRequest();
    req.input('annId', announcementId);
    req.input('type', t.targetType);
    req.input('targetId', t.targetId);
    await req.query(`
      INSERT INTO ${AUDIENCE} (AnnouncementId, TargetType, TargetId)
      VALUES (@annId, @type, @targetId)
    `);
  }
}

export async function getAudience(announcementId: number): Promise<AudienceRow[]> {
  const req = await getRequest();
  req.input('annId', announcementId);
  const result = await req.query(`
    SELECT a.Id AS id, a.AnnouncementId AS announcementId,
           a.TargetType AS targetType, a.TargetId AS targetId,
           a.CreatedAt AS createdAt,
           CASE a.TargetType
             WHEN 'BRANCH' THEN b.BranchName
             WHEN 'DEPARTMENT' THEN d.DepartmentName
             WHEN 'TEAM' THEN t.Name
             WHEN 'DESIGNATION' THEN des.Name
             WHEN 'ROLE' THEN ro.RoleName
             WHEN 'USER' THEN u.Name
           END AS targetName
    FROM ${AUDIENCE} a
    LEFT JOIN [${S}].[utbl_Branch] b ON a.TargetType = 'BRANCH' AND b.Id = a.TargetId
    LEFT JOIN [${S}].[utbl_Org_Department] d ON a.TargetType = 'DEPARTMENT' AND d.Id = a.TargetId
    LEFT JOIN [${S}].[utbl_Org_Team] t ON a.TargetType = 'TEAM' AND t.Id = a.TargetId
    LEFT JOIN [${S}].[utbl_Org_Designation] des ON a.TargetType = 'DESIGNATION' AND des.Id = a.TargetId
    LEFT JOIN [${S}].[react_Roles] ro ON a.TargetType = 'ROLE' AND ro.RoleID = a.TargetId
    LEFT JOIN [${S}].[utbl_Users_Master] u ON a.TargetType = 'USER' AND u.UserId = a.TargetId
    WHERE a.AnnouncementId = @annId
    ORDER BY a.TargetType, a.TargetId
  `);
  return result.recordset;
}

/**
 * Resolves all targeted user IDs for an announcement.
 * Handles BRANCH, DEPARTMENT, TEAM, DESIGNATION, ROLE, USER, and company-wide.
 * Returns distinct active user IDs.
 */
export async function resolveTargetedUserIds(announcementId: number): Promise<number[]> {
  const req = await getRequest();
  req.input('annId', announcementId);
  const result = await req.query(`
    DECLARE @isCompanyWide BIT;
    SELECT @isCompanyWide = IsCompanyWide FROM [${S}].[utbl_Announcements_Master] WHERE Id = @annId;

    IF @isCompanyWide = 1
    BEGIN
      SELECT DISTINCT u.UserId AS userId
      FROM [${S}].[utbl_Users_Master] u
      WHERE u.IsActive = 1;
    END
    ELSE
    BEGIN
      SELECT DISTINCT userId FROM (
        -- BRANCH: users with branch access
        SELECT uba.UserID AS userId
        FROM ${AUDIENCE} aud
        INNER JOIN [${S}].[utbl_UserBranchAccess] uba ON uba.BranchId = aud.TargetId AND uba.IsActive = 1
        WHERE aud.AnnouncementId = @annId AND aud.TargetType = 'BRANCH'

        UNION

        -- DEPARTMENT: users by org department
        SELECT ep.UserID AS userId
        FROM ${AUDIENCE} aud
        INNER JOIN [${S}].[hrms_EmployeeProfile] ep ON ep.OrgDepartmentId = aud.TargetId
        INNER JOIN [${S}].[utbl_Users_Master] u ON u.UserId = ep.UserID AND u.IsActive = 1
        WHERE aud.AnnouncementId = @annId AND aud.TargetType = 'DEPARTMENT'

        UNION

        -- TEAM: active members in team
        SELECT tm.UserId AS userId
        FROM ${AUDIENCE} aud
        INNER JOIN [${S}].[utbl_Org_TeamMember] tm ON tm.TeamId = aud.TargetId AND tm.LeftAt IS NULL
        INNER JOIN [${S}].[utbl_Users_Master] u ON u.UserId = tm.UserId AND u.IsActive = 1
        WHERE aud.AnnouncementId = @annId AND aud.TargetType = 'TEAM'

        UNION

        -- DESIGNATION: users by designation
        SELECT ep.UserID AS userId
        FROM ${AUDIENCE} aud
        INNER JOIN [${S}].[hrms_EmployeeProfile] ep ON ep.OrgDesignationId = aud.TargetId
        INNER JOIN [${S}].[utbl_Users_Master] u ON u.UserId = ep.UserID AND u.IsActive = 1
        WHERE aud.AnnouncementId = @annId AND aud.TargetType = 'DESIGNATION'

        UNION

        -- ROLE: users with role
        SELECT ur.UserID AS userId
        FROM ${AUDIENCE} aud
        INNER JOIN [${S}].[react_UserRoles] ur ON ur.RoleID = aud.TargetId
        INNER JOIN [${S}].[utbl_Users_Master] u ON u.UserId = ur.UserID AND u.IsActive = 1
        WHERE aud.AnnouncementId = @annId AND aud.TargetType = 'ROLE'
          AND ur.RevokedAt IS NULL

        UNION

        -- USER: direct
        SELECT aud.TargetId AS userId
        FROM ${AUDIENCE} aud
        INNER JOIN [${S}].[utbl_Users_Master] u ON u.UserId = aud.TargetId AND u.IsActive = 1
        WHERE aud.AnnouncementId = @annId AND aud.TargetType = 'USER'
      ) AS allUsers;
    END
  `);
  return result.recordset.map((r: any) => r.userId);
}

/**
 * Check if a specific user is targeted by an announcement.
 */
export async function isUserTargeted(announcementId: number, userId: number): Promise<boolean> {
  const ids = await resolveTargetedUserIds(announcementId);
  return ids.includes(userId);
}
