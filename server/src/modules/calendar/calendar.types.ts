/**
 * Calendar module types.
 */

export type CalendarCategory =
  | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'danger' | 'dark' | 'purple';

export type CalendarScope = 'personal' | 'company';

export interface CalendarEventRow {
  Id: number;
  Title: string;
  Start: Date;
  End: Date | null;
  AllDay: boolean;
  Category: string;
  Scope: string;
  ReminderMinutes: number | null;
  CreatedByUserId: number;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export interface CalendarEventPayload {
  id: number;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  category: CalendarCategory;
  scope: CalendarScope;
  reminderMinutes: number | null;
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
}

export type CalendarView = 'personal' | 'company' | 'all';

export interface CalendarUserRow {
  userId: number;
  name: string;
  email: string;
}
