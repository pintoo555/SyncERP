/**
 * hMailServer Email Admin DTOs.
 */

export interface DomainDto {
  id: number;
  name: string;
  active: boolean;
}

export interface AccountDto {
  id: number;
  address: string;
  active: boolean;
  maxSize: number;
  personFirstName: string;
  personLastName: string;
}

export interface AliasDto {
  id: number;
  name: string;
  value: string;
  active: boolean;
}

export interface DistributionListDto {
  id: number;
  address: string;
  active: boolean;
}
