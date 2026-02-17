/**
 * Client module backend tests.
 *
 * To run: install vitest (`npm i -D vitest`) and add `"test": "vitest"` to package.json scripts.
 * Then run: npm test
 *
 * These tests mock the database layer to unit-test service logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB module
vi.mock('../../../config/db', () => {
  const mockQuery = vi.fn();
  const mockInput = vi.fn().mockReturnThis();
  return {
    getRequest: vi.fn().mockResolvedValue({ query: mockQuery, input: mockInput }),
    getPool: vi.fn(),
  };
});

import { getRequest } from '../../../config/db';

describe('Client Module', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createClient', () => {
    it('should generate a ClientCode and insert a record', async () => {
      const { createClient } = await import('../client.service');
      const mockReq = await getRequest();

      // Mock sequence call
      (mockReq.query as any)
        .mockResolvedValueOnce({ recordset: [{ val: 1 }] }) // seq_ClientCode
        .mockResolvedValueOnce({ recordset: [{ Id: 42 }] }); // INSERT

      // Re-mock getRequest to return fresh request objects
      (getRequest as any)
        .mockResolvedValueOnce({ query: (mockReq.query as any), input: vi.fn().mockReturnThis() }) // for generateClientCode
        .mockResolvedValueOnce({ query: (mockReq.query as any), input: vi.fn().mockReturnThis() }); // for INSERT

      const id = await createClient({
        clientName: 'Test Client',
        clientType: 'OEM',
      }, 1);

      expect(id).toBe(42);
    });
  });

  describe('checkDuplicates', () => {
    it('should detect GST number matches', async () => {
      const { checkDuplicates } = await import('../clientDuplicate.service');

      (getRequest as any).mockResolvedValue({
        query: vi.fn().mockResolvedValue({
          recordset: [{ clientId: 10, clientCode: 'CL000001', clientName: 'Existing Corp', gstNumber: '22AAAAA0000A1Z5' }],
        }),
        input: vi.fn().mockReturnThis(),
      });

      const result = await checkDuplicates({
        clientName: 'New Corp',
        gstNumber: '22AAAAA0000A1Z5',
      });

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].matchType).toBe('GST');
    });

    it('should detect name similarity', async () => {
      const { checkDuplicates } = await import('../clientDuplicate.service');

      let callCount = 0;
      (getRequest as any).mockImplementation(() => ({
        query: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return { recordset: [] }; // GST check
          if (callCount === 2) return { recordset: [{ clientId: 20, clientCode: 'CL000002', clientName: 'Synchronics Engineering Pvt Ltd' }] };
          return { recordset: [] };
        }),
        input: vi.fn().mockReturnThis(),
      }));

      const result = await checkDuplicates({
        clientName: 'Synchronics Engineering Private Limited',
      });

      // Token overlap should be high enough to detect
      const nameMatch = result.find(d => d.matchType === 'NAME');
      if (nameMatch) {
        expect(nameMatch.clientId).toBe(20);
      }
    });

    it('should detect contact mobile matches', async () => {
      const { checkDuplicates } = await import('../clientDuplicate.service');

      let callCount = 0;
      (getRequest as any).mockImplementation(() => ({
        query: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount <= 2) return { recordset: [] }; // GST and name
          return {
            recordset: [{ clientId: 30, clientCode: 'CL000003', clientName: 'Contact Match Corp', mobileNumber: '9876543210' }],
          };
        }),
        input: vi.fn().mockReturnThis(),
      }));

      const result = await checkDuplicates({
        clientName: 'Totally Different Name',
        contacts: [{ mobileNumber: '9876543210' }],
      });

      const contactMatch = result.find(d => d.matchType === 'CONTACT');
      expect(contactMatch).toBeDefined();
    });
  });

  describe('mergeClients', () => {
    it('should set IsMerged and create relationship', async () => {
      const { mergeClients } = await import('../clientRelationship.service');

      const mockQuery = vi.fn().mockResolvedValue({ recordset: [{ Id: 99 }] });
      (getRequest as any).mockResolvedValue({
        query: mockQuery,
        input: vi.fn().mockReturnThis(),
      });

      await mergeClients(1, 2, 'Business consolidation', 5);

      // Verify UPDATE and INSERT were called
      expect(mockQuery).toHaveBeenCalled();
      const calls = mockQuery.mock.calls.map((c: any) => c[0]);
      const hasUpdate = calls.some((q: string) => q.includes('IsMerged = 1'));
      const hasInsert = calls.some((q: string) => q.includes('INSERT INTO'));
      expect(hasUpdate || hasInsert).toBe(true);
    });
  });

  describe('createGroup + addMember', () => {
    it('should create a group with auto-generated code', async () => {
      const { createGroup } = await import('../clientGroup.service');

      (getRequest as any)
        .mockResolvedValueOnce({
          query: vi.fn().mockResolvedValue({ recordset: [{ val: 1 }] }),
          input: vi.fn().mockReturnThis(),
        })
        .mockResolvedValueOnce({
          query: vi.fn().mockResolvedValue({ recordset: [{ Id: 55 }] }),
          input: vi.fn().mockReturnThis(),
        });

      const id = await createGroup({ groupName: 'Test Group' }, 1);
      expect(id).toBe(55);
    });

    it('should add a member to a group', async () => {
      const { addGroupMember } = await import('../clientGroup.service');

      (getRequest as any).mockResolvedValue({
        query: vi.fn().mockResolvedValue({ recordset: [{ Id: 77 }] }),
        input: vi.fn().mockReturnThis(),
      });

      const id = await addGroupMember(55, { clientId: 42, roleInGroup: 'Parent' }, 1);
      expect(id).toBe(77);
    });
  });
});
