/**
 * Re-export from modules/hrms for backward compatibility.
 */
export {
  listDepartments,
  listDesignations,
  listEmployees,
  getEmployeeProfile,
  upsertEmployeeProfile,
  listFamily,
  addFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
  getEmployeeBank,
  upsertEmployeeBank,
  updateUserDepartmentAndName,
  getUserNameAndEmail,
} from '../modules/hrms/hrms.service';
export type {
  DepartmentRow,
  DesignationRow,
  EmployeeProfileRow,
  EmployeeFamilyRow,
  EmployeeBankRow,
  EmployeeListItem,
} from '../modules/hrms/hrms.types';
