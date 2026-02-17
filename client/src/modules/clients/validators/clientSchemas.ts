/**
 * Zod validation schemas for Client module forms.
 */

import { z } from 'zod';

export const clientBasicSchema = z.object({
  clientName: z.string().min(1, 'Client name is required').max(200),
  clientDisplayName: z.string().max(200).optional().or(z.literal('')),
  clientType: z.enum(['OEM', 'Dealer', 'EndUser', 'Govt', 'Export'], {
    required_error: 'Client type is required',
  }),
  industryId: z.coerce.number().int().positive().optional().or(z.literal(0)),
});

export const clientComplianceSchema = z.object({
  gstNumber: z.string()
    .regex(/^$|^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GST format')
    .optional()
    .or(z.literal('')),
  panNumber: z.string()
    .regex(/^$|^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format')
    .optional()
    .or(z.literal('')),
  iecCode: z.string().max(30).optional().or(z.literal('')),
  msmeNumber: z.string().max(30).optional().or(z.literal('')),
  currencyCode: z.string().min(1).max(10).default('INR'),
  creditLimit: z.coerce.number().min(0).default(0),
  creditDays: z.coerce.number().int().min(0).default(0),
});

export const addressSchema = z.object({
  addressType: z.enum(['Billing', 'Shipping', 'HO', 'Factory', 'Other'], {
    required_error: 'Address type is required',
  }),
  addressLine1: z.string().min(1, 'Address Line 1 is required').max(300),
  addressLine2: z.string().max(300).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  stateId: z.coerce.number().int().positive().optional().or(z.literal(0)),
  countryId: z.coerce.number().int().positive().optional().or(z.literal(0)),
  pincode: z.string()
    .regex(/^$|^[0-9]{6}$/, 'Pincode must be 6 digits')
    .optional()
    .or(z.literal('')),
  isDefault: z.boolean().default(false),
});

export const contactSchema = z.object({
  contactName: z.string().min(1, 'Contact name is required').max(200),
  designation: z.string().max(100).optional().or(z.literal('')),
  department: z.string().max(100).optional().or(z.literal('')),
  mobileNumber: z.string()
    .regex(/^$|^[6-9][0-9]{9}$/, 'Invalid Indian mobile number')
    .optional()
    .or(z.literal('')),
  alternateNumber: z.string().max(20).optional().or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  whatsAppNumber: z.string().max(20).optional().or(z.literal('')),
  isPrimary: z.boolean().default(false),
});

export type ClientBasicForm = z.infer<typeof clientBasicSchema>;
export type ClientComplianceForm = z.infer<typeof clientComplianceSchema>;
export type AddressForm = z.infer<typeof addressSchema>;
export type ContactForm = z.infer<typeof contactSchema>;
