// Tracks all changes to values in Vitals-monitor.js and Anesthesia-monitor.js

class EventLog {
    constructor() {
        this.events = [];
        this.listeners = [];
    }

    log(event) {
        const timestamp = new Date().toISOString();
        const entry = { ...event, timestamp };
        this.events.push(entry);
        this.listeners.forEach(fn => fn(entry));
    }

    getEvents() {
        return this.events.slice();
    }

    onLog(fn) {
        this.listeners.push(fn);
    }
}

// Singleton pattern for global event log
window.eventLog = window.eventLog || new EventLog();

export default window.eventLog;
