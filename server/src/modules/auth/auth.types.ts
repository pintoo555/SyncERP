export interface UserRow {
  userid: number;
  Name: string;
  DepartmentID: number | null;
  Username: string | null;
  Email: string;
  /** Bcrypt hash only (from utbl_Users_Master.PasswordHash). */
  PasswordHash: string;
  IsActive: number | boolean;
}
