/**
 * Central route definitions for the ERP application.
 * All routes import page components from their module folders.
 */
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import MainLayout from '../layout/MainLayout';
import { Login } from '../modules/auth';
import {
  DashboardAdmin,
  DashboardSelf,
  AssetsList,
  AssetDetail,
  MyAssets,
  Masters,
  Search,
  PrintLabels,
  Reports,
  VerificationsList,
  TicketsList,
  TicketDetail,
  TicketNew,
  TicketBoard,
  AssetBoard,
} from '../modules/assets';
import { AuditList, AuditDashboard } from '../modules/auditLog';
import {
  UserRoles,
  SettingsOverview,
  GeneralSettings,
  AIConfig,
  AIAnalytics,
  EmailSettings,
  ActiveSessions,
  CronJobsSettings,
} from '../modules/settings';
import { AccountsOverview, Invoices, CreditNotes } from '../modules/accounts';
import { Calendar } from '../modules/calendar';
import { Chat } from '../modules/chat';
import { EmailApp, MailboxSettings } from '../modules/emails';
import { HRMSEmployees, HRMSEmployeeDetail, HRMSProfile, HRMSUserSearch, HRMSDepartmentManagement, HRMSDesignationManagement, HRMSTeamsOrg } from '../modules/hrms';
import { CommunicationDashboard, CommunicationMessages, CommunicationSandbox } from '../modules/communication';
import { CallMatrixDashboard, CallMatrixSearch } from '../modules/callMatrix';
import { Dashboard } from '../modules/dashboards';
import { Health, HealthAlertSettings } from '../modules/health';
import { JobCardList, JobCardSearch } from '../modules/jobcards';
import { WorkLogs } from '../modules/worklogs';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-5 text-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RedirectTicketsId() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/assets/tickets/${id}` : '/assets/tickets'} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="user-roles" element={<Navigate to="/settings/users-roles" replace />} />
        {/* Legacy redirects */}
        <Route path="assets/dashboard" element={<DashboardSelf />} />
        <Route path="dashboard/admin" element={<Navigate to="/assets/dashboard/admin" replace />} />
        <Route path="my-assets" element={<Navigate to="/assets/my" replace />} />
        <Route path="search" element={<Navigate to="/assets/search" replace />} />
        <Route path="masters" element={<Navigate to="/assets/masters" replace />} />
        <Route path="reports" element={<Navigate to="/assets/reports" replace />} />
        <Route path="verifications" element={<Navigate to="/assets/verifications" replace />} />
        <Route path="print-labels" element={<Navigate to="/assets/print-labels" replace />} />
        <Route path="tickets" element={<Navigate to="/assets/tickets" replace />} />
        <Route path="tickets/new" element={<Navigate to="/assets/tickets/new" replace />} />
        <Route path="tickets/:id" element={<RedirectTicketsId />} />
        <Route path="board/tickets" element={<Navigate to="/assets/tickets/board" replace />} />
        <Route path="board/assets" element={<Navigate to="/assets/board" replace />} />
        <Route path="assets" element={<AssetsList />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="health" element={<Health />} />
        <Route path="health/settings" element={<HealthAlertSettings />} />
        <Route path="assets/dashboard/admin" element={<DashboardAdmin />} />
        <Route path="assets/masters" element={<Masters />} />
        <Route path="assets/reports" element={<Reports />} />
        <Route path="assets/board" element={<AssetBoard />} />
        <Route path="assets/my" element={<MyAssets />} />
        <Route path="assets/search" element={<Search />} />
        <Route path="assets/verifications" element={<VerificationsList />} />
        <Route path="assets/print-labels" element={<PrintLabels />} />
        <Route path="assets/tickets/new" element={<TicketNew />} />
        <Route path="assets/tickets/board" element={<TicketBoard />} />
        <Route path="assets/tickets/:id" element={<TicketDetail />} />
        <Route path="assets/tickets" element={<TicketsList />} />
        <Route path="assets/:id" element={<AssetDetail />} />
        <Route path="jobcard" element={<JobCardList />} />
        <Route path="jobcard/search" element={<JobCardSearch />} />
        <Route path="jobcard/worklogs" element={<Navigate to="/worklogs" replace />} />
        <Route path="worklogs" element={<WorkLogs />} />
        <Route path="accounts" element={<AccountsOverview />} />
        <Route path="accounts/invoices" element={<Invoices />} />
        <Route path="accounts/credit-notes" element={<CreditNotes />} />
        <Route path="settings" element={<SettingsOverview />} />
        <Route path="settings/general" element={<GeneralSettings />} />
        <Route path="settings/users-roles" element={<UserRoles />} />
        <Route path="settings/active-sessions" element={<ActiveSessions />} />
        <Route path="settings/ai-config" element={<AIConfig />} />
        <Route path="settings/ai-analytics" element={<AIAnalytics />} />
        <Route path="settings/email-settings" element={<EmailSettings />} />
        <Route path="settings/cron-jobs" element={<CronJobsSettings />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="chat" element={<Chat />} />
        <Route path="emails" element={<EmailApp />} />
        <Route path="emails/settings" element={<MailboxSettings />} />
        <Route path="audit" element={<AuditDashboard />} />
        <Route path="audit/log" element={<AuditList />} />
        <Route path="hrms/employees" element={<HRMSEmployees />} />
        <Route path="hrms/employees/:userId" element={<HRMSEmployeeDetail />} />
        <Route path="hrms/profile" element={<HRMSProfile />} />
        <Route path="hrms/user-search" element={<HRMSUserSearch />} />
        <Route path="hrms/departments" element={<HRMSDepartmentManagement />} />
        <Route path="hrms/designations" element={<HRMSDesignationManagement />} />
        <Route path="hrms/teams" element={<HRMSTeamsOrg />} />
        <Route path="communication" element={<CommunicationDashboard />} />
        <Route path="communication/messages" element={<CommunicationMessages />} />
        <Route path="settings/communication-sandbox" element={<CommunicationSandbox />} />
        <Route path="call-matrix" element={<CallMatrixDashboard />} />
        <Route path="call-matrix/search" element={<CallMatrixSearch />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
