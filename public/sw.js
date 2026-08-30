self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : { title: "MyScheduler", body: "일정 알림" };
  event.waitUntil(self.registration.showNotification(data.title || "MyScheduler", {
    body: data.body || "일정이 곧 시작됩니다.",
    data: { url: data.url || "/" },
    tag: data.tag || "myscheduler-reminder"
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url || "/"));
});
