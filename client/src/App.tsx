/**
 * ERP Application root - providers and routing.
 */
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ChatSocketProvider } from './contexts/ChatSocketContext';
import { ChatUnreadProvider } from './contexts/ChatUnreadContext';
import { EmailUnreadProvider } from './contexts/EmailUnreadContext';
import { HealthAlertsProvider } from './contexts/HealthAlertsContext';
import { CalendarSocketProvider } from './contexts/CalendarSocketContext';
import { AppSettingsProvider } from './contexts/AppSettingsContext';
import { UserSettingsProvider } from './contexts/UserSettingsContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ApiConnectivity } from './components/ApiConnectivity';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppRoutes } from './routes/AppRoutes';

export default function App() {
  return (
    <ErrorBoundary>
      <ApiConnectivity>
        <AuthProvider>
          <BrowserRouter>
            <AppSettingsProvider>
              <UserSettingsProvider>
                <ThemeProvider>
                  <ChatSocketProvider>
                    <CalendarSocketProvider>
                      <HealthAlertsProvider>
                        <ChatUnreadProvider>
                          <EmailUnreadProvider>
                            <AppRoutes />
                          </EmailUnreadProvider>
                        </ChatUnreadProvider>
                      </HealthAlertsProvider>
                    </CalendarSocketProvider>
                  </ChatSocketProvider>
                </ThemeProvider>
              </UserSettingsProvider>
            </AppSettingsProvider>
          </BrowserRouter>
        </AuthProvider>
      </ApiConnectivity>
    </ErrorBoundary>
  );
}
