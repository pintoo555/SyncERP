export interface UserRow {
  userid: number;
  Name: string;
  DepartmentID: number | null;
  Username: string | null;
  Email: string;
  Password: string;
  IsActive: number | boolean;
}
