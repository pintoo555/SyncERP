/**
 * Re-export from modules/calendar for backward compatibility.
 */
export {
  listEvents,
  listAvailabilityEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  listCalendarUsers,
} from '../modules/calendar/calendar.service';
export type { CalendarCategory, CalendarScope, CalendarEventPayload, CalendarView, CalendarUserRow } from '../modules/calendar/calendar.service';
