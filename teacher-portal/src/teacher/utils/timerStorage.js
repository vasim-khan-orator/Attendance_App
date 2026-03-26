// src/teacher/utils/timerStorage.js

export const timerStorage = {
  // Timer settings
  getTimerSettings() {
    const settings = localStorage.getItem("timerSettings");
    return settings ? JSON.parse(settings) : {
      duration: 10 * 60 * 60, // 10 hours in seconds
      isRunning: false,
      startTime: null,
      remainingTime: 10 * 60 * 60
    };
  },

  saveTimerSettings(settings) {
    localStorage.setItem("timerSettings", JSON.stringify(settings));
  },

  startTimer() {
    const settings = this.getTimerSettings();
    settings.isRunning = true;
    settings.startTime = Date.now();
    this.saveTimerSettings(settings);
  },

  stopTimer() {
    const settings = this.getTimerSettings();
    if (settings.isRunning) {
      const elapsed = Math.floor((Date.now() - settings.startTime) / 1000);
      settings.remainingTime = Math.max(0, settings.remainingTime - elapsed);
    }
    settings.isRunning = false;
    this.saveTimerSettings(settings);
  },

  resetTimer() {
    const settings = this.getTimerSettings();
    settings.isRunning = false;
    settings.startTime = null;
    settings.remainingTime = 10 * 60 * 60;
    this.saveTimerSettings(settings);
  },

  getRemainingTime() {
    const settings = this.getTimerSettings();
    if (!settings.isRunning) return settings.remainingTime;
    
    const elapsed = Math.floor((Date.now() - settings.startTime) / 1000);
    return Math.max(0, settings.remainingTime - elapsed);
  }
};
