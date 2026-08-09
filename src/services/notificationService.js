const fs = require('node:fs');
const path = require('node:path');

let sharedNotificationService;

function createNotificationService({ storagePath } = {}) {
    const resolvedStoragePath = storagePath || path.join(__dirname, '..', '..', 'data', 'notifications.json');

    function ensureStorageFile() {
        fs.mkdirSync(path.dirname(resolvedStoragePath), { recursive: true });

        if (!fs.existsSync(resolvedStoragePath)) {
            fs.writeFileSync(resolvedStoragePath, '[]', 'utf8');
        }
    }

    function readNotifications() {
        ensureStorageFile();

        try {
            const fileContent = fs.readFileSync(resolvedStoragePath, 'utf8').trim();
            return fileContent ? JSON.parse(fileContent) : [];
        } catch (error) {
            console.error('Impossible de lire les notifications persistées :', error);
            return [];
        }
    }

    function saveNotifications(notifications) {
        ensureStorageFile();
        fs.writeFileSync(resolvedStoragePath, JSON.stringify(notifications, null, 2), 'utf8');
        return notifications;
    }

    function createNotification({ title, content, datetime }) {
        const notifications = readNotifications();
        const nextId = notifications.length > 0
            ? Math.max(...notifications.map((notification) => notification.id)) + 1
            : 1;

        const notification = {
            id: nextId,
            title,
            content,
            datetime,
            read: false,
        };

        notifications.push(notification);
        saveNotifications(notifications);
        return notification;
    }

    function listNotifications() {
        const unreadNotifications = readNotifications().filter((notification) => !notification.read);
        return unreadNotifications;
    }

    function markNotificationAsRead(id) {
        const notifications = readNotifications();
        const targetNotification = notifications.find((notification) => notification.id === Number(id));

        if (!targetNotification) {
            return null;
        }

        targetNotification.read = true;
        saveNotifications(notifications);
        return targetNotification;
    }

    return {
        createNotification,
        listNotifications,
        markNotificationAsRead,
    };
}

function getNotificationService() {
    if (!sharedNotificationService) {
        sharedNotificationService = createNotificationService();
    }

    return sharedNotificationService;
}

module.exports = {
    createNotificationService,
    getNotificationService,
};
