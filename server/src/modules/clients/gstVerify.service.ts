/**
 * GST verification service: calls GSTZen API to validate GSTIN and fetch company details.
 * Reads the API key from react_ApiConfig where ServiceCode = 'GSTZEN'.
 */

import * as apiConfigService from '../../services/apiConfigService';

export interface GstAddress {
  addressLine1: string;
  addressLine2: string;
  city: string;
  pincode: string;
}

export interface GstVerifyResult {
  valid: boolean;
  gstin: string;
  legalName: string | null;
  tradeName: string | null;
  pan: string | null;
  companyStatus: string | null;
  gstType: string | null;
  registrationDate: string | null;
  stateCode: string | null;
  stateName: string | null;
  principalAddress: GstAddress | null;
  additionalAddresses: GstAddress[];
}

function parseGstZenAddress(addr: any): GstAddress | null {
  if (!addr) return null;
  const street = (addr.street || '').trim();
  const loc = (addr.loc || '').trim();
  const fullAddr = (addr.addr || '').trim();
  const pincode = (addr.pincode || '').trim();

  return {
    addressLine1: street || fullAddr,
    addressLine2: loc && street ? loc : '',
    city: loc || '',
    pincode,
  };
}

export async function verifyGstin(gstin: string): Promise<GstVerifyResult> {
  if (!gstin || gstin.trim().length < 15) {
    throw new Error('Invalid GSTIN format. GSTIN must be 15 characters.');
  }

  const gstinClean = gstin.trim().toUpperCase();

  // Get GSTZen API config
  const config = await apiConfigService.getByServiceCode('GSTZEN');
  if (!config || !config.apiKey) {
    throw new Error('GSTZen API is not configured. Please add a GSTZEN service in Settings > API Configuration with your API key.');
  }

  const apiKey = config.apiKey;
  const baseUrl = config.baseUrl?.trim() || 'https://my.gstzen.in/api/gstin-validator/';

  // Call GSTZen API
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Token': apiKey,
    },
    body: JSON.stringify({ gstin: gstinClean }),
  });

  if (!response.ok) {
    throw new Error(`GSTZen API returned HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.status === 0) {
    throw new Error(data.message || 'GSTZen API error. Check your subscription.');
  }

  if (!data.valid) {
    return {
      valid: false,
      gstin: gstinClean,
      legalName: null,
      tradeName: null,
      pan: null,
      companyStatus: null,
      gstType: null,
      registrationDate: null,
      stateCode: null,
      stateName: null,
      principalAddress: null,
      additionalAddresses: [],
    };
  }

  const details = data.company_details || {};
  const stateInfo = details.state_info || {};

  const principalAddress = parseGstZenAddress(details.pradr);
  const additionalAddresses = Array.isArray(details.adadr)
    ? details.adadr.map(parseGstZenAddress).filter((a: GstAddress | null): a is GstAddress => a !== null)
    : [];

  return {
    valid: true,
    gstin: gstinClean,
    legalName: details.legal_name || null,
    tradeName: details.trade_name || null,
    pan: details.pan || null,
    companyStatus: details.company_status || null,
    gstType: details.gst_type || null,
    registrationDate: details.registration_date || null,
    stateCode: stateInfo.code || null,
    stateName: stateInfo.name || null,
    principalAddress,
    additionalAddresses,
  };
}
