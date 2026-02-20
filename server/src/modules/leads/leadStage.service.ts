import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type { LeadStage, LeadStageCreate, LeadStageUpdate } from './leads.types';

const SCHEMA = config.db.schema || 'dbo';
const STAGE = `[${SCHEMA}].[utbl_Leads_Stage]`;

function mapRow(r: any): LeadStage {
  return {
    stageId: r.stageId ?? r.StageId,
    stageName: r.stageName ?? r.StageName ?? '',
    stageOrder: r.stageOrder ?? r.StageOrder ?? 0,
    color: r.color ?? r.Color ?? '#6c757d',
    isDefault: !!(r.isDefault ?? r.IsDefault),
    isWon: !!(r.isWon ?? r.IsWon),
    isLost: !!(r.isLost ?? r.IsLost),
    isActive: !!(r.isActive ?? r.IsActive),
  };
}

export async function getAllStages(includeInactive?: boolean): Promise<LeadStage[]> {
  const req = await getRequest();
  req.input('all', includeInactive ? 1 : 0);
  const result = await req.query(`
    SELECT StageId AS stageId, StageName AS stageName, StageOrder AS stageOrder,
           Color AS color, IsDefault AS isDefault, IsWon AS isWon,
           IsLost AS isLost, IsActive AS isActive
    FROM ${STAGE}
    WHERE (@all = 1 OR IsActive = 1)
    ORDER BY StageOrder
  `);
  return (result.recordset || []).map(mapRow);
}

export async function getStageById(id: number): Promise<LeadStage | null> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`
    SELECT StageId AS stageId, StageName AS stageName, StageOrder AS stageOrder,
           Color AS color, IsDefault AS isDefault, IsWon AS isWon,
           IsLost AS isLost, IsActive AS isActive
    FROM ${STAGE}
    WHERE StageId = @id
  `);
  const r = result.recordset?.[0];
  return r ? mapRow(r) : null;
}

export async function getDefaultStage(): Promise<LeadStage | null> {
  const req = await getRequest();
  const result = await req.query(`
    SELECT TOP 1
           StageId AS stageId, StageName AS stageName, StageOrder AS stageOrder,
           Color AS color, IsDefault AS isDefault, IsWon AS isWon,
           IsLost AS isLost, IsActive AS isActive
    FROM ${STAGE}
    WHERE IsDefault = 1 AND IsActive = 1
  `);
  const r = result.recordset?.[0];
  return r ? mapRow(r) : null;
}

export async function createStage(data: LeadStageCreate, userId: number | null): Promise<number> {
  if (data.isDefault) {
    await clearDefaultFlag(userId);
  }

  const req = await getRequest();
  req.input('name', (data.stageName || '').trim().slice(0, 100));
  req.input('order', data.stageOrder ?? 0);
  req.input('color', (data.color || '#6c757d').trim().slice(0, 20));
  req.input('isDefault', data.isDefault ? 1 : 0);
  req.input('isWon', data.isWon ? 1 : 0);
  req.input('isLost', data.isLost ? 1 : 0);
  req.input('createdBy', userId);

  const result = await req.query(`
    DECLARE @out TABLE (StageId INT);
    INSERT INTO ${STAGE}
      (StageName, StageOrder, Color, IsDefault, IsWon, IsLost, CreatedBy)
    OUTPUT INSERTED.StageId INTO @out
    VALUES (@name, @order, @color, @isDefault, @isWon, @isLost, @createdBy);
    SELECT StageId FROM @out;
  `);
  return (result.recordset as { StageId: number }[])[0].StageId;
}

export async function updateStage(id: number, data: LeadStageUpdate, userId: number | null): Promise<void> {
  if (data.isDefault) {
    await clearDefaultFlag(userId);
  }

  const sets: string[] = [];
  const req = await getRequest();
  req.input('id', id);

  if (data.stageName !== undefined) {
    req.input('name', data.stageName.trim().slice(0, 100));
    sets.push('StageName = @name');
  }
  if (data.stageOrder !== undefined) {
    req.input('order', data.stageOrder);
    sets.push('StageOrder = @order');
  }
  if (data.color !== undefined) {
    req.input('color', data.color.trim().slice(0, 20));
    sets.push('Color = @color');
  }
  if (data.isDefault !== undefined) {
    req.input('isDefault', data.isDefault ? 1 : 0);
    sets.push('IsDefault = @isDefault');
  }
  if (data.isWon !== undefined) {
    req.input('isWon', data.isWon ? 1 : 0);
    sets.push('IsWon = @isWon');
  }
  if (data.isLost !== undefined) {
    req.input('isLost', data.isLost ? 1 : 0);
    sets.push('IsLost = @isLost');
  }
  if (data.isActive !== undefined) {
    req.input('isActive', data.isActive ? 1 : 0);
    sets.push('IsActive = @isActive');
  }

  if (sets.length === 0) return;

  req.input('updatedBy', userId);
  sets.push('UpdatedOn = GETDATE()', 'UpdatedBy = @updatedBy');

  await req.query(`
    UPDATE ${STAGE}
    SET ${sets.join(', ')}
    WHERE StageId = @id
  `);
}

export async function toggleStageStatus(id: number, isActive: boolean, userId: number | null): Promise<void> {
  if (!isActive) {
    const stage = await getStageById(id);
    if (stage && (stage.isWon || stage.isLost)) {
      throw new Error('Cannot deactivate a stage marked as Won or Lost');
    }
  }

  const req = await getRequest();
  req.input('id', id);
  req.input('isActive', isActive ? 1 : 0);
  req.input('updatedBy', userId);
  await req.query(`
    UPDATE ${STAGE}
    SET IsActive = @isActive, UpdatedOn = GETDATE(), UpdatedBy = @updatedBy
    WHERE StageId = @id
  `);
}

export async function reorderStages(orderedIds: number[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    const req = await getRequest();
    req.input('id', orderedIds[i]);
    req.input('order', i + 1);
    await req.query(`
      UPDATE ${STAGE}
      SET StageOrder = @order
      WHERE StageId = @id
    `);
  }
}

async function clearDefaultFlag(userId: number | null): Promise<void> {
  const req = await getRequest();
  req.input('updatedBy', userId);
  await req.query(`
    UPDATE ${STAGE}
    SET IsDefault = 0, UpdatedOn = GETDATE(), UpdatedBy = @updatedBy
    WHERE IsDefault = 1
  `);
}
