/**
 * Notification History Page
 *
 * Displays a list of past notifications.
 * Allows users to view event details, mark as read, or clear history.
 */

import { useState } from 'react';
import { useNotificationStore } from '../stores/notifications';
import { useCurrentProfile } from '../hooks/useCurrentProfile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Bell, Trash2, CheckCheck, ExternalLink, AlertCircle, Wifi, Smartphone, RefreshCw } from 'lucide-react';
import { getEventCauseIcon } from '../lib/event-icons';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NotificationBadge } from '../components/NotificationBadge';
import { useAuthStore } from '../stores/auth';

export default function NotificationHistory() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentProfile } = useCurrentProfile();
  const { getEvents, getUnreadCount, markEventRead, markAllRead, clearEvents } = useNotificationStore();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

  // Get events and unread count for current profile
  const events = currentProfile ? getEvents(currentProfile.id) : [];
  const unreadCount = currentProfile ? getUnreadCount(currentProfile.id) : 0;

  const handleViewEvent = (eventId: number) => {
    if (currentProfile) {
      markEventRead(currentProfile.id, eventId);
    }
    navigate(`/events/${eventId}`);
  };

  const handleMarkAllRead = () => {
    if (currentProfile) {
      markAllRead(currentProfile.id);
    }
  };

  const handleClearEvents = () => {
    if (currentProfile) {
      clearEvents(currentProfile.id);
    }
  };

  // Early return if no profile
  if (!currentProfile) {
    return (
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-3">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold">{t('notification_history.no_profile')}</h2>
            <p className="text-muted-foreground">{t('notification_history.select_profile_first')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="p-3 sm:p-4 md:p-6 max-w-5xl mx-auto space-y-4 sm:space-y-6"
      data-testid="notification-history"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold tracking-tight">
              {t('notification_history.title')}
            </h1>
            <NotificationBadge />
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 hidden sm:block">
            {t('notification_history.subtitle')}
          </p>
        </div>

        <div className="flex gap-1.5 sm:gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" onClick={handleMarkAllRead} size="sm" className="h-8 sm:h-10">
              <CheckCheck className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('notification_history.mark_all_read')}</span>
            </Button>
          )}
          {events.length > 0 && (
            <Button variant="destructive" onClick={() => setIsClearDialogOpen(true)} size="sm" className="h-8 sm:h-10" data-testid="clear-history-button">
              <Trash2 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('notification_history.clear_all')}</span>
            </Button>
          )}
        </div>
      </div>

      {events.length === 0 ? (
        <Card data-testid="notification-history-empty">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bell className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('notification_history.no_notifications')}</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              {t('notification_history.no_notifications_desc')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4" data-testid="notification-history-list">
          {events.map((event) => (
            <Card
              key={`${event.EventId}-${event.receivedAt}`}
              className={event.read ? 'opacity-60' : 'border-primary'}
            >
              <CardHeader className="p-3 sm:p-6 pb-3 sm:pb-3">
                <div className="flex items-start justify-between gap-2 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base sm:text-lg break-words">{event.MonitorName}</CardTitle>
                      {!event.read && (
                        <Badge variant="destructive" className="text-[10px] sm:text-xs shrink-0">
                          {t('notification_history.new')}
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="mt-1 text-xs sm:text-sm flex items-center gap-1.5">
                      {formatDistanceToNow(event.receivedAt, { addSuffix: true })}
                      <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                        {event.source === 'push' ? (
                          <>
                            <Smartphone className="h-3 w-3" />
                            <span className="hidden sm:inline">{t('notification_history.source_push')}</span>
                          </>
                        ) : event.source === 'poll' ? (
                          <>
                            <RefreshCw className="h-3 w-3" />
                            <span className="hidden sm:inline">{t('notification_history.source_poll')}</span>
                          </>
                        ) : (
                          <>
                            <Wifi className="h-3 w-3" />
                            <span className="hidden sm:inline">{t('notification_history.source_websocket')}</span>
                          </>
                        )}
                      </span>
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewEvent(event.EventId)}
                    className="shrink-0 h-8 sm:h-9 px-2 sm:px-3"
                  >
                    <ExternalLink className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">{t('notification_history.view_event')}</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  {event.ImageUrl && (
                    <div className="flex-shrink-0">
                      <img
                        src={accessToken ? `${event.ImageUrl}&token=${accessToken}` : event.ImageUrl}
                        alt={`Event ${event.EventId}`}
                        className="h-32 w-auto rounded-lg border object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => handleViewEvent(event.EventId)}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    {(() => {
                      const causeDisplay = event.Cause.split('|')[0].trim();
                      const CauseIcon = getEventCauseIcon(causeDisplay);
                      return (
                        <div className="flex items-center gap-2">
                          <CauseIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium" title={event.Cause}>{causeDisplay}</span>
                        </div>
                      );
                    })()}
                    {event.Notes && (
                      <p className="text-xs text-muted-foreground truncate" title={event.Notes}>
                        {event.Notes.split('|')[0].trim()}
                      </p>
                    )}
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>{t('notification_history.event_id', { id: event.EventId })}</div>
                      <div>{t('notification_history.monitor_id', { id: event.MonitorId })}</div>
                    </div>
                    {!event.read && currentProfile && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => markEventRead(currentProfile.id, event.EventId)}
                      >
                        {t('notification_history.mark_read')}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {events.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          {t('notification_history.showing_count', { count: events.length })}
        </div>
      )}

      <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <AlertDialogContent data-testid="clear-history-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('notification_history.clear_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('notification_history.clear_confirm_desc', { count: events.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="clear-history-cancel">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearEvents}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="clear-history-confirm"
            >
              {t('notification_history.clear_all')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
