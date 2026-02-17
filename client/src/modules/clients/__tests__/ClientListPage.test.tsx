/**
 * Client module frontend tests.
 *
 * To run: install vitest + testing library:
 *   npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom
 * Add to vite.config.ts: test: { environment: 'jsdom', globals: true }
 * Then: npx vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock the API
vi.mock('../api/clientsApi', () => ({
  listClients: vi.fn(),
  listIndustries: vi.fn(),
  patchClientStatus: vi.fn(),
  createClient: vi.fn(),
}));

// Mock formatIndian
vi.mock('../../../utils/formatIndian', () => ({
  formatIndianNumber: (n: number) => String(n ?? 0),
}));

import * as clientsApi from '../api/clientsApi';

describe('ClientListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (clientsApi.listIndustries as any).mockResolvedValue({ data: [] });
  });

  it('should render the clients table with data', async () => {
    (clientsApi.listClients as any).mockResolvedValue({
      success: true,
      data: [
        {
          id: 1, clientCode: 'CL000001', clientName: 'Acme Corp', clientDisplayName: null,
          clientType: 'OEM', industryId: 1, industryName: 'Cement',
          gstNumber: '22AAAAA0000A1Z5', panNumber: null, iecCode: null, msmeNumber: null,
          currencyCode: 'INR', creditLimit: 500000, creditDays: 30,
          isBlacklisted: false, isActive: true, isMerged: false,
          mergedIntoClientId: null, mergedIntoClientName: null,
          createdOn: '2025-01-01', createdBy: 1, updatedOn: null, updatedBy: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 25,
    });

    const ClientListPage = (await import('../pages/ClientListPage')).default;

    render(
      <BrowserRouter>
        <ClientListPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeTruthy();
    });

    expect(screen.getByText('CL000001')).toBeTruthy();
    expect(screen.getByText('OEM')).toBeTruthy();
  });

  it('should show empty state when no clients', async () => {
    (clientsApi.listClients as any).mockResolvedValue({
      success: true, data: [], total: 0, page: 1, pageSize: 25,
    });

    const ClientListPage = (await import('../pages/ClientListPage')).default;

    render(
      <BrowserRouter>
        <ClientListPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No clients found.')).toBeTruthy();
    });
  });

  it('should trigger search on button click', async () => {
    (clientsApi.listClients as any).mockResolvedValue({
      success: true, data: [], total: 0, page: 1, pageSize: 25,
    });

    const ClientListPage = (await import('../pages/ClientListPage')).default;

    render(
      <BrowserRouter>
        <ClientListPage />
      </BrowserRouter>
    );

    await waitFor(() => screen.getByText('No clients found.'));

    const searchInput = screen.getByPlaceholderText('Name, code, GST...');
    fireEvent.change(searchInput, { target: { value: 'Acme' } });

    const searchBtn = screen.getByText('Search');
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(clientsApi.listClients).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Acme' })
      );
    });
  });
});

describe('DuplicateWarningModal', () => {
  it('should render duplicate warnings and allow confirmation', async () => {
    const DuplicateWarningModal = (await import('../components/DuplicateWarningModal')).default;

    const duplicates = [
      { clientId: 1, clientCode: 'CL000001', clientName: 'Existing Corp', matchType: 'GST' as const, matchDetail: 'GST: 22AAAAA0000A1Z5' },
    ];

    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <DuplicateWarningModal
        duplicates={duplicates}
        onConfirm={onConfirm}
        onCancel={onCancel}
        saving={false}
      />
    );

    expect(screen.getByText('Potential Duplicates Found')).toBeTruthy();
    expect(screen.getByText('Existing Corp')).toBeTruthy();
    expect(screen.getByText('GST')).toBeTruthy();

    fireEvent.click(screen.getByText('Confirm Create Anyway'));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
