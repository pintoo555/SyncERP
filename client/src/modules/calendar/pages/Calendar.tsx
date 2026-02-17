import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, DateSelectArg, EventDropArg, EventInput } from '@fullcalendar/core';
import type { EventContentArg } from '@fullcalendar/core';
import { api } from '../../../api/client';
import { useCalendarSocketContext } from '../../../contexts/CalendarSocketContext';
import { useAppSettings } from '../../../contexts/AppSettingsContext';
import { useAuth } from '../../../hooks/useAuth';
import { utcToAppTzInputValue, parseAppTzToUtc } from '../../../utils/dateUtils';

export type CalendarEventCategory =
  | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'danger' | 'dark' | 'purple';

export type CalendarScope = 'personal' | 'company';

export interface CalendarEventData {
  id: string;
  title: string;
  start: string;
  end?: string | null;
  category: CalendarEventCategory;
  allDay?: boolean;
  scope?: CalendarScope;
  reminderMinutes?: number | null;
  createdByUserId?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface CalendarUser {
  userId: number;
  name: string;
  email: string;
}

const CATEGORY_OPTIONS: { value: CalendarEventCategory; label: string; class: string }[] = [
  { value: 'primary', label: 'Primary', class: 'primary' },
  { value: 'secondary', label: 'Secondary', class: 'secondary' },
  { value: 'success', label: 'Success', class: 'success' },
  { value: 'info', label: 'Info', class: 'info' },
  { value: 'warning', label: 'Warning', class: 'warning' },
  { value: 'danger', label: 'Danger', class: 'danger' },
  { value: 'dark', label: 'Dark', class: 'dark' },
  { value: 'purple', label: 'Purple', class: 'purple' },
];

const REMINDER_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'None' },
  { value: 0, label: 'At time of event' },
  { value: 5, label: '5 minutes before' },
  { value: 10, label: '10 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' },
];

type CalendarView = 'personal' | 'company' | 'all';

function toFullCalendarEvent(ev: CalendarEventData, isAvailability?: boolean, availabilityUserName?: string): EventInput {
  return {
    id: isAvailability ? `avail-${ev.id}` : ev.id,
    title: ev.title,
    start: ev.start,
    end: ev.end ?? undefined,
    allDay: ev.allDay ?? false,
    extendedProps: {
      category: ev.category,
      createdByUserId: ev.createdByUserId,
      isAvailability: isAvailability ?? false,
      availabilityUserName: availabilityUserName,
    },
    classNames: isAvailability ? ['fc-availability-event'] : [],
    editable: !isAvailability,
  };
}

export default function Calendar() {
  const { user } = useAuth();
  const { timeZone } = useAppSettings();
  const { calendarEventVersion } = useCalendarSocketContext();
  const permissions = user?.permissions ?? [];
  const canCreateCompany = permissions.includes('CALENDAR.CREATE_COMPANY');
  const canViewAvailability = permissions.includes('CALENDAR.VIEW_AVAILABILITY');

  const [calendarView, setCalendarView] = useState<CalendarView>('all');
  const [events, setEvents] = useState<CalendarEventData[]>([]);
  const [availabilityUserId, setAvailabilityUserId] = useState<number | null>(null);
  const [availabilityEvents, setAvailabilityEvents] = useState<CalendarEventData[]>([]);
  const [calendarUsers, setCalendarUsers] = useState<CalendarUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<CalendarEventCategory>('primary');
  const [formScope, setFormScope] = useState<CalendarScope>('personal');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formAllDay, setFormAllDay] = useState(true);
  const [formReminderMinutes, setFormReminderMinutes] = useState<number | null>(null);
  const [formError, setFormError] = useState('');
  const [currentTitle, setCurrentTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const fetchRef = useRef<{ start: string; end: string } | null>(null);
  const eventsRef = useRef<CalendarEventData[]>([]);
  const reminderEventsRef = useRef<CalendarEventData[]>([]);
  eventsRef.current = events;

  const fetchEvents = useCallback(async (start?: string, end?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('view', calendarView);
      if (start) params.set('start', start);
      if (end) params.set('end', end);
      const res = await api.get<{ success: boolean; events: CalendarEventData[] }>(
        `/api/calendar/events?${params.toString()}`
      );
      const list = res?.events ?? [];
      setEvents(list.map((e) => ({
        ...e,
        id: String(e.id),
        allDay: e.allDay ?? false,
        scope: e.scope ?? 'personal',
        reminderMinutes: e.reminderMinutes ?? null,
      })));
    } catch (_) {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [calendarView]);

  const fetchAvailability = useCallback(async (userId: number, start?: string, end?: string) => {
    try {
      const params = new URLSearchParams();
      params.set('userId', String(userId));
      if (start) params.set('start', start);
      if (end) params.set('end', end);
      const res = await api.get<{ success: boolean; events: CalendarEventData[] }>(
        `/api/calendar/availability?${params.toString()}`
      );
      const list = res?.events ?? [];
      setAvailabilityEvents(list.map((e) => ({
        ...e,
        id: String(e.id),
        allDay: e.allDay ?? false,
      })));
    } catch (_) {
      setAvailabilityEvents([]);
    }
  }, []);

  useEffect(() => {
    fetchEvents(fetchRef.current?.start, fetchRef.current?.end);
  }, [calendarEventVersion, fetchEvents]);

  useEffect(() => {
    if (availabilityUserId && fetchRef.current) {
      fetchAvailability(availabilityUserId, fetchRef.current.start, fetchRef.current.end);
    } else {
      setAvailabilityEvents([]);
    }
  }, [availabilityUserId, calendarEventVersion, fetchAvailability]);

  useEffect(() => {
    if (canViewAvailability) {
      api.get<{ success: boolean; users: CalendarUser[] }>('/api/calendar/users')
        .then((res) => setCalendarUsers(res?.users ?? []))
        .catch(() => setCalendarUsers([]));
    }
  }, [canViewAvailability]);

  // Fetch events for reminder checks (view=all, next 7 days) so reminders work regardless of current view
  useEffect(() => {
    if (!user?.userId) return;
    const fetchForReminders = () => {
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 7);
      const params = new URLSearchParams();
      params.set('view', 'all');
      params.set('start', start.toISOString());
      params.set('end', end.toISOString());
      api.get<{ success: boolean; events: CalendarEventData[] }>(`/api/calendar/events?${params.toString()}`)
        .then((res) => {
          reminderEventsRef.current = (res?.events ?? []).map((e) => ({
            ...e,
            id: String(e.id),
            reminderMinutes: e.reminderMinutes ?? null,
            createdByUserId: e.createdByUserId,
          }));
        })
        .catch(() => { reminderEventsRef.current = []; });
    };
    fetchForReminders();
    const tid = setInterval(fetchForReminders, 5 * 60 * 1000);
    return () => clearInterval(tid);
  }, [user?.userId]);

  // Browser notifications for reminders: request permission and check every 30s
  useEffect(() => {
    if (typeof window === 'undefined' || !window.Notification || !user?.userId) return;
    const NOTIFICATION_KEY = 'cal_reminder_done';
    const CHECK_INTERVAL_MS = 30 * 1000;
    const REMINDER_WINDOW_MS = 2 * 60 * 1000;

    const requestPermission = () => {
      if (window.Notification.permission === 'default') {
        window.Notification.requestPermission().catch(() => {});
      }
    };
    requestPermission();

    const checkReminders = () => {
      if (window.Notification.permission !== 'granted') return;
      const now = Date.now();
      const list = reminderEventsRef.current;
      const myId = user.userId;
      for (const ev of list) {
        if (ev.createdByUserId !== myId || ev.reminderMinutes == null) continue;
        const startMs = new Date(ev.start).getTime();
        if (startMs <= now) continue;
        const notifyAt = startMs - ev.reminderMinutes * 60 * 1000;
        if (now < notifyAt || now > notifyAt + REMINDER_WINDOW_MS) continue;
        const key = `${NOTIFICATION_KEY}_${ev.id}_${ev.start}`;
        try {
          if (localStorage.getItem(key)) continue;
          localStorage.setItem(key, '1');
          const label = ev.reminderMinutes === 0 ? 'now' : ev.reminderMinutes < 60
            ? `${ev.reminderMinutes} min`
            : ev.reminderMinutes < 1440 ? `${Math.floor(ev.reminderMinutes / 60)} hour` : '1 day';
          new window.Notification(ev.title, {
            body: `Reminder: ${label} before`,
            icon: '/favicon.ico',
            tag: `cal-${ev.id}`,
          });
        } catch (_) {}
      }
    };

    checkReminders();
    const tid = setInterval(checkReminders, CHECK_INTERVAL_MS);
    return () => clearInterval(tid);
  }, [user?.userId]);

  const handleDatesSet = useCallback((arg: { startStr: string; endStr: string }) => {
    fetchRef.current = { start: arg.startStr, end: arg.endStr };
    setLoading(true);
    fetchEvents(arg.startStr, arg.endStr);
    if (availabilityUserId) {
      fetchAvailability(availabilityUserId, arg.startStr, arg.endStr);
    }
  }, [fetchEvents, availabilityUserId, fetchAvailability]);

  const availabilityUser = availabilityUserId != null ? calendarUsers.find((u) => u.userId === availabilityUserId) : null;

  const fcEvents = useMemo(() => {
    const main = events.map((ev) => toFullCalendarEvent(ev, false));
    if (availabilityUserId && availabilityUser) {
      const avail = availabilityEvents.map((ev) =>
        toFullCalendarEvent(ev, true, availabilityUser.name)
      );
      return [...main, ...avail];
    }
    return main;
  }, [events, availabilityEvents, availabilityUserId, availabilityUser]);

  const openCreate = useCallback((start?: Date, end?: Date, allDay?: boolean) => {
    setEditingId(null);
    setFormTitle('');
    setFormCategory('primary');
    setFormScope(canCreateCompany ? 'company' : 'personal');
    setFormReminderMinutes(null);
    const isAllDay = allDay ?? true;
    const s = start ?? new Date();
    const e = end ?? s;
    const sIso = s instanceof Date ? s.toISOString() : s;
    const eIso = e instanceof Date ? e.toISOString() : e;
    setFormStart(utcToAppTzInputValue(sIso, timeZone, isAllDay));
    setFormEnd(utcToAppTzInputValue(eIso, timeZone, isAllDay));
    setFormAllDay(isAllDay);
    setFormError('');
    setCurrentTitle('Create Event');
    setModalOpen(true);
  }, [timeZone, canCreateCompany]);

  const openEdit = useCallback((ev: CalendarEventData) => {
    if ((ev as { extendedProps?: { isAvailability?: boolean } }).extendedProps?.isAvailability) return;
    setEditingId(ev.id);
    setFormTitle(ev.title);
    setFormCategory(ev.category);
    setFormScope(ev.scope ?? 'personal');
    setFormReminderMinutes(ev.reminderMinutes ?? null);
    const allDay = ev.allDay ?? true;
    setFormStart(utcToAppTzInputValue(ev.start, timeZone, allDay));
    setFormEnd(utcToAppTzInputValue(ev.end || ev.start, timeZone, allDay));
    setFormAllDay(allDay);
    setFormError('');
    setCurrentTitle('Edit Event');
    setModalOpen(true);
  }, [timeZone]);

  const handleSave = useCallback(async () => {
    const title = formTitle.trim();
    if (!title) {
      setFormError('Please provide a valid event name');
      return;
    }
    setFormError('');
    setSaving(true);
    try {
      let start: string;
      let end: string | null = null;
      if (formAllDay) {
        const startDate = formStart.slice(0, 10);
        const endDate = formEnd?.slice(0, 10) || startDate;
        start = `${startDate}T00:00:00.000Z`;
        end = `${endDate}T23:59:59.999Z`;
      } else {
        start = parseAppTzToUtc(formStart, timeZone);
        end = formEnd ? parseAppTzToUtc(formEnd, timeZone) : null;
      }
      const payload = {
        title,
        start,
        end,
        allDay: formAllDay,
        category: formCategory,
        scope: formScope,
        reminderMinutes: formReminderMinutes,
      };
      if (editingId) {
        await api.put(`/api/calendar/events/${editingId}`, payload);
      } else {
        await api.post('/api/calendar/events', payload);
      }
      setModalOpen(false);
      fetchEvents(fetchRef.current?.start, fetchRef.current?.end);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [editingId, formTitle, formStart, formEnd, formCategory, formScope, formAllDay, formReminderMinutes, fetchEvents, timeZone]);

  const handleDelete = useCallback(async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await api.delete(`/api/calendar/events/${editingId}`);
      setModalOpen(false);
      fetchEvents(fetchRef.current?.start, fetchRef.current?.end);
    } catch (_) {
    } finally {
      setSaving(false);
    }
  }, [editingId, fetchEvents]);

  const handleDateSelect = useCallback(
    (arg: DateSelectArg) => {
      openCreate(arg.start, arg.end, arg.allDay);
    },
    [openCreate]
  );

  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      const isAvail = (arg.event.extendedProps as { isAvailability?: boolean })?.isAvailability;
      if (isAvail) return;
      const ev = events.find((e) => e.id === arg.event.id);
      if (ev) openEdit(ev);
    },
    [events, openEdit]
  );

  const handleEventDrop = useCallback(async (arg: EventDropArg) => {
    if ((arg.event.extendedProps as { isAvailability?: boolean })?.isAvailability) return;
    const id = arg.event.id;
    const start = arg.event.start!.toISOString();
    const end = arg.event.end?.toISOString() ?? null;
    try {
      await api.put(`/api/calendar/events/${id}`, { start, end, allDay: arg.event.allDay });
      setEvents((prev) =>
        prev.map((e) => (e.id === id ? { ...e, start, end: end ?? undefined } : e))
      );
    } catch (_) {
      arg.revert();
    }
  }, []);

  const eventContent = useCallback((arg: EventContentArg) => {
    const props = arg.event.extendedProps as {
      category?: CalendarEventCategory;
      isAvailability?: boolean;
      availabilityUserName?: string;
      createdByUserId?: number;
    };
    const isAvailability = props?.isAvailability === true;
    const cat = (props?.category as CalendarEventCategory) || 'primary';
    const opt = CATEGORY_OPTIONS.find((o) => o.value === cat);
    const isPurple = cat === 'purple';
    const bgClass = isPurple ? '' : (opt ? `bg-${opt.class}` : 'bg-primary');
    const style = isPurple ? { backgroundColor: 'var(--bs-purple, #6f42c1)', color: '#fff' } : undefined;

    if (isAvailability && props?.availabilityUserName) {
      const userId = props.createdByUserId;
      const photoSrc = userId != null ? `/user-photos/${userId}.jpg` : undefined;
      return (
        <div className={`d-flex align-items-center gap-1 p-1 rounded small text-truncate text-white bg-opacity-90 ${bgClass}`} style={style}>
          {photoSrc && (
            <img
              src={photoSrc}
              alt=""
              width={20}
              height={20}
              className="rounded-circle flex-shrink-0"
              style={{ objectFit: 'cover' }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <span className="text-truncate">{arg.event.title}</span>
          <span className="small opacity-75 text-truncate">({props.availabilityUserName})</span>
        </div>
      );
    }

    return (
      <div className={`p-1 rounded small text-truncate text-white bg-opacity-90 ${bgClass}`} style={style}>
        {arg.event.title}
      </div>
    );
  }, []);

  const modalEl = modalOpen && (
    <div
      className="calendar-modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-modal-title"
      onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}
    >
      <div
        className="calendar-modal-dialog"
        role="document"
        style={{
          position: 'relative',
          zIndex: 10000,
          maxWidth: 500,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card shadow">
          <div className="card-header d-flex align-items-center justify-content-between">
            <h5 id="calendar-modal-title" className="card-title mb-0">{currentTitle}</h5>
            <button type="button" className="btn-close" onClick={() => setModalOpen(false)} aria-label="Close" />
          </div>
          <div className="card-body">
            {formError && (
              <div className="alert alert-danger py-2 small" role="alert">
                {formError}
              </div>
            )}
            <div className="mb-3">
              <label className="form-label">Event Name <span className="text-danger">*</span></label>
              <input
                type="text"
                className="form-control"
                placeholder="Event name"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>
            {canCreateCompany && (
              <div className="mb-3">
                <label className="form-label">Calendar</label>
                <select
                  className="form-select"
                  value={formScope}
                  onChange={(e) => setFormScope(e.target.value as CalendarScope)}
                >
                  <option value="personal">Personal (only you)</option>
                  <option value="company">Company (everyone can see)</option>
                </select>
              </div>
            )}
            <div className="mb-3">
              <label className="form-label">Category</label>
              <select
                className="form-select"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as CalendarEventCategory)}
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label">Reminder</label>
              <select
                className="form-select"
                value={formReminderMinutes ?? ''}
                onChange={(e) => setFormReminderMinutes(e.target.value === '' ? null : parseInt(e.target.value, 10))}
              >
                {REMINDER_OPTIONS.map((opt) => (
                  <option key={String(opt.value)} value={opt.value ?? ''}>{opt.label}</option>
                ))}
              </select>
              <p className="form-text small text-muted mb-0">Allow browser notifications to receive reminders at the chosen time.</p>
            </div>
            <div className="mb-3">
              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="calAllDay"
                  checked={formAllDay}
                  onChange={(e) => setFormAllDay(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="calAllDay">All day</label>
              </div>
            </div>
            <div className="row g-2 mb-3">
              <div className="col-md-6">
                <label className="form-label small">Start</label>
                <input
                  type={formAllDay ? 'date' : 'datetime-local'}
                  className="form-control form-control-sm"
                  value={formAllDay ? formStart.slice(0, 10) : formStart}
                  onChange={(e) => setFormStart(formAllDay ? e.target.value + 'T00:00:00' : e.target.value)}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label small">End</label>
                <input
                  type={formAllDay ? 'date' : 'datetime-local'}
                  className="form-control form-control-sm"
                  value={formAllDay ? formEnd.slice(0, 10) : formEnd}
                  onChange={(e) => setFormEnd(formAllDay ? e.target.value + 'T23:59:59' : e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="card-footer d-flex flex-wrap gap-2 justify-content-end">
            {editingId && (
              <button type="button" className="btn btn-outline-danger me-auto" onClick={handleDelete} disabled={saving}>
                Delete
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Close
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container-fluid py-3">
      <div className="row">
        <div className="col-12">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <div>
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb mb-1">
                  <li className="breadcrumb-item"><Link to="/">Home</Link></li>
                  <li className="breadcrumb-item"><Link to="/">Apps</Link></li>
                  <li className="breadcrumb-item active" aria-current="page">Calendar</li>
                </ol>
              </nav>
              <h4 className="mb-0">Calendar</h4>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openCreate();
              }}
              aria-label="Create new event"
            >
              <i className="ti ti-plus me-1" />
              Create New Event
            </button>
          </div>

          <div className="mb-3 d-flex flex-wrap align-items-center gap-2">
            <span className="small fw-semibold">View:</span>
            <div className="btn-group btn-group-sm" role="group">
              <button
                type="button"
                className={`btn btn-outline-primary ${calendarView === 'personal' ? 'active' : ''}`}
                onClick={() => setCalendarView('personal')}
              >
                My Calendar
              </button>
              <button
                type="button"
                className={`btn btn-outline-primary ${calendarView === 'company' ? 'active' : ''}`}
                onClick={() => setCalendarView('company')}
              >
                Company
              </button>
              <button
                type="button"
                className={`btn btn-outline-primary ${calendarView === 'all' ? 'active' : ''}`}
                onClick={() => setCalendarView('all')}
              >
                All
              </button>
            </div>
            {canViewAvailability && (
              <div className="d-flex align-items-center gap-2 ms-2 border-start ps-3">
                <label className="small text-muted mb-0">User availability:</label>
                <select
                  className="form-select form-select-sm"
                  style={{ width: 'auto', minWidth: 160 }}
                  value={availabilityUserId ?? ''}
                  onChange={(e) => setAvailabilityUserId(e.target.value === '' ? null : parseInt(e.target.value, 10))}
                >
                  <option value="">— None —</option>
                  {calendarUsers.map((u) => (
                    <option key={u.userId} value={u.userId}>{u.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="card shadow-sm position-relative">
            <div className="card-body">
              <p className="text-muted small mb-3">
                {calendarView === 'personal' && 'Only your personal events.'}
                {calendarView === 'company' && 'Company events visible to everyone.'}
                {calendarView === 'all' && 'Your personal events and all company events. Drag to resize; click to edit.'}
                {availabilityUserId && availabilityUser && ` Showing availability for ${availabilityUser.name}.`}
              </p>
              {loading && (
                <div className="position-absolute top-0 start-0 end-0 py-2 text-center text-muted small bg-light bg-opacity-75 rounded" style={{ zIndex: 10 }}>
                  Updating…
                </div>
              )}
              <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                timeZone={timeZone}
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,dayGridWeek',
                }}
                editable
                selectable
                selectMirror
                dayMaxEvents={5}
                weekends
                events={fcEvents}
                datesSet={handleDatesSet}
                select={handleDateSelect}
                eventClick={handleEventClick}
                eventDrop={handleEventDrop}
                eventContent={eventContent}
                height={600}
              />
            </div>
          </div>
        </div>
      </div>

      {typeof document !== 'undefined' && createPortal(modalEl, document.body)}
    </div>
  );
}
