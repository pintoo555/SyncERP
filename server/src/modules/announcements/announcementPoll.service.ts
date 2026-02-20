/**
 * Poll and poll response service.
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type { PollRow, PollCreateData, PollResponseRow, PollResultSummary } from './announcements.types';

const S = config.db.schema || 'dbo';
const POLL     = `[${S}].[utbl_Announcements_Poll]`;
const RESPONSE = `[${S}].[utbl_Announcements_PollResponse]`;

export async function createPoll(announcementId: number, data: PollCreateData): Promise<number> {
  const req = await getRequest();
  req.input('annId', announcementId);
  req.input('question', data.question.trim().slice(0, 500));
  req.input('type', data.pollType || 'SINGLE');
  req.input('options', JSON.stringify(data.options));
  const result = await req.query(`
    INSERT INTO ${POLL} (AnnouncementId, Question, PollType, Options)
    OUTPUT INSERTED.Id
    VALUES (@annId, @question, @type, @options)
  `);
  return result.recordset[0].Id;
}

export async function updatePoll(pollId: number, data: Partial<PollCreateData>): Promise<void> {
  const sets: string[] = [];
  const req = await getRequest();
  req.input('id', pollId);
  if (data.question) { req.input('q', data.question.trim().slice(0, 500)); sets.push('Question = @q'); }
  if (data.pollType) { req.input('t', data.pollType); sets.push('PollType = @t'); }
  if (data.options) { req.input('o', JSON.stringify(data.options)); sets.push('Options = @o'); }
  if (!sets.length) return;
  await req.query(`UPDATE ${POLL} SET ${sets.join(', ')} WHERE Id = @id`);
}

export async function deletePoll(pollId: number): Promise<void> {
  const req = await getRequest();
  req.input('id', pollId);
  await req.query(`DELETE FROM ${POLL} WHERE Id = @id`);
}

export async function getPolls(announcementId: number): Promise<PollRow[]> {
  const req = await getRequest();
  req.input('annId', announcementId);
  const result = await req.query(`
    SELECT Id AS id, AnnouncementId AS announcementId, Question AS question,
           PollType AS pollType, Options AS options, IsActive AS isActive, CreatedAt AS createdAt
    FROM ${POLL}
    WHERE AnnouncementId = @annId AND IsActive = 1
    ORDER BY CreatedAt
  `);
  return result.recordset.map((r: any) => ({
    ...r,
    options: typeof r.options === 'string' ? JSON.parse(r.options) : r.options,
  }));
}

export async function submitResponse(pollId: number, userId: number, selectedOptions: string[]): Promise<void> {
  const delReq = await getRequest();
  delReq.input('pollId', pollId);
  delReq.input('userId', userId);
  await delReq.query(`DELETE FROM ${RESPONSE} WHERE PollId = @pollId AND UserId = @userId`);

  for (const opt of selectedOptions) {
    const req = await getRequest();
    req.input('pollId', pollId);
    req.input('userId', userId);
    req.input('opt', opt);
    await req.query(`
      INSERT INTO ${RESPONSE} (PollId, UserId, SelectedOption)
      VALUES (@pollId, @userId, @opt)
    `);
  }
}

export async function getUserResponses(announcementId: number, userId: number): Promise<{ pollId: number; selectedOption: string }[]> {
  const req = await getRequest();
  req.input('annId', announcementId);
  req.input('userId', userId);
  const result = await req.query(`
    SELECT pr.PollId AS pollId, pr.SelectedOption AS selectedOption
    FROM ${RESPONSE} pr
    INNER JOIN ${POLL} p ON p.Id = pr.PollId
    WHERE p.AnnouncementId = @annId AND pr.UserId = @userId
  `);
  return result.recordset;
}

export async function getPollResults(pollId: number): Promise<PollResultSummary> {
  const req = await getRequest();
  req.input('pollId', pollId);
  const pollRes = await req.query(`
    SELECT Id AS id, Question AS question, PollType AS pollType, Options AS options
    FROM ${POLL} WHERE Id = @pollId
  `);
  if (!pollRes.recordset.length) throw new Error('Poll not found');
  const poll = pollRes.recordset[0];
  const options: string[] = typeof poll.options === 'string' ? JSON.parse(poll.options) : poll.options;

  const countReq = await getRequest();
  countReq.input('pollId', pollId);
  const countRes = await countReq.query(`
    SELECT SelectedOption AS opt, COUNT(DISTINCT UserId) AS cnt
    FROM ${RESPONSE}
    WHERE PollId = @pollId
    GROUP BY SelectedOption
  `);

  const totalReq = await getRequest();
  totalReq.input('pollId', pollId);
  const totalRes = await totalReq.query(`
    SELECT COUNT(DISTINCT UserId) AS total FROM ${RESPONSE} WHERE PollId = @pollId
  `);
  const total = totalRes.recordset[0].total;

  const countMap: Record<string, number> = {};
  for (const r of countRes.recordset) countMap[r.opt] = r.cnt;

  return {
    pollId,
    question: poll.question,
    pollType: poll.pollType,
    options,
    totalResponses: total,
    results: options.map((opt) => ({
      option: opt,
      count: countMap[opt] || 0,
      percentage: total > 0 ? Math.round(((countMap[opt] || 0) / total) * 100) : 0,
    })),
  };
}
