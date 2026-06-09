import { Bell, BellRing, CheckCheck, CheckCircle2, ClockAlert, UserRoundCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { Notification } from "../types";

const icons = {
  TASK_ASSIGNED: UserRoundCheck,
  TASK_REMINDER: BellRing,
  TASK_OVERDUE: ClockAlert,
  TASK_COMPLETED: CheckCircle2
} as const;

export function NotificationCenter() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    api<{ notifications: Notification[]; unreadCount: number }>("/notifications?limit=20")
      .then((data) => {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30_000);
    window.addEventListener("focus", load);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  async function openNotification(notification: Notification) {
    if (!notification.readAt) {
      await api(`/notifications/${notification.id}/read`, { method: "PATCH" });
    }
    setOpen(false);
    load();
    if (notification.taskId) navigate("/tasks");
  }

  async function readAll() {
    await api("/notifications/read-all", { method: "POST" });
    load();
  }

  return (
    <div className="notification-center">
      <button
        className="icon-button notification-trigger"
        aria-label="Notifications"
        title="Notifications"
        onClick={() => { setOpen((value) => !value); if (!open) load(); }}
      >
        <Bell size={18} />
        {unreadCount > 0 && <span>{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>
      {open && (
        <>
          <button className="notification-scrim" aria-label="Close notifications" onClick={() => setOpen(false)} />
          <section className="notification-panel">
            <header>
              <div><strong>Notifications</strong><small>{unreadCount} unread</small></div>
              {unreadCount > 0 && <button className="icon-button" title="Mark all as read" onClick={readAll}><CheckCheck size={17} /></button>}
            </header>
            <div>
              {notifications.map((notification) => {
                const Icon = icons[notification.type];
                return (
                  <button
                    key={notification.id}
                    className={notification.readAt ? "" : "is-unread"}
                    onClick={() => openNotification(notification)}
                  >
                    <span><Icon size={16} /></span>
                    <p>
                      <strong>{notification.title}</strong>
                      {notification.body && <small>{notification.body}</small>}
                      <time>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(notification.createdAt))}</time>
                    </p>
                  </button>
                );
              })}
              {!notifications.length && <p className="notification-empty">No notifications.</p>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
