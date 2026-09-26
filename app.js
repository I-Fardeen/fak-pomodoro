const DEFAULT_SETTINGS = {
    focusMinutes: 25,
    breakMinutes: 5,
    soundEnabled: true,
    notificationsEnabled: false
};

const STATE_KEY = "fak-pomodoro-state";
const SETTINGS_KEY = "fak-pomodoro-settings";
const STATISTICS_KEY = "fak-pomodoro-statistics";

let settings = loadSettings();

let state = {
    phase: "focus",
    remainingSeconds: settings.focusMinutes * 60,
    totalSeconds: settings.focusMinutes * 60,
    running: false,
    completedPomodoros: 0,
    endTime: null
};

let statistics = {};

let timerInterval = null;


/* --------------------------------------------------
   DOM Elements
-------------------------------------------------- */

const timerElement =
    document.getElementById("timer");

const phaseLabelElement =
    document.getElementById("phaseLabel");

const progressElement =
    document.getElementById("progressBar");

const startButton =
    document.getElementById("startButton");

const resetButton =
    document.getElementById("resetButton");

const skipButton =
    document.getElementById("skipButton");

const completedPomodorosElement =
    document.getElementById("completedPomodoros");

const todayPomodorosElement =
    document.getElementById("todayPomodoros");

const todayFocusElement =
    document.getElementById("todayFocus");

const todayBreakElement =
    document.getElementById("todayBreak");

const historyListElement =
    document.getElementById("historyList");

const settingsButton =
    document.getElementById("settingsButton");

const closeSettingsButton =
    document.getElementById("closeSettingsButton");

const settingsPanel =
    document.getElementById("settingsPanel");

const focusDurationInput =
    document.getElementById("focusDuration");

const breakDurationInput =
    document.getElementById("breakDuration");

const soundEnabledInput =
    document.getElementById("soundEnabled");

const notificationsEnabledInput =
    document.getElementById("notificationsEnabled");

const saveSettingsButton =
    document.getElementById("saveSettingsButton");


/* --------------------------------------------------
   Settings
-------------------------------------------------- */

function loadSettings() {
    try {
        const saved =
            localStorage.getItem(SETTINGS_KEY);

        if (!saved) {
            return { ...DEFAULT_SETTINGS };
        }

        return {
            ...DEFAULT_SETTINGS,
            ...JSON.parse(saved)
        };
    } catch (error) {
        console.error(
            "Failed to load settings:",
            error
        );

        return { ...DEFAULT_SETTINGS };
    }
}

function saveSettings() {
    localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(settings)
    );
}

function populateSettingsForm() {
    focusDurationInput.value =
        settings.focusMinutes;

    breakDurationInput.value =
        settings.breakMinutes;

    soundEnabledInput.checked =
        settings.soundEnabled;

    notificationsEnabledInput.checked =
        settings.notificationsEnabled;
}

async function applySettings() {
    const focusMinutes =
        Number(focusDurationInput.value);

    const breakMinutes =
        Number(breakDurationInput.value);

    if (
        !Number.isInteger(focusMinutes) ||
        focusMinutes < 1 ||
        focusMinutes > 60
    ) {
        alert(
            "Focus duration must be between 1 and 60 minutes."
        );

        return;
    }

    if (
        !Number.isInteger(breakMinutes) ||
        breakMinutes < 1 ||
        breakMinutes > 30
    ) {
        alert(
            "Break duration must be between 1 and 30 minutes."
        );

        return;
    }

    const notificationsRequested =
        notificationsEnabledInput.checked;

    settings.focusMinutes =
        focusMinutes;

    settings.breakMinutes =
        breakMinutes;

    settings.soundEnabled =
        soundEnabledInput.checked;

    settings.notificationsEnabled =
        notificationsRequested;

    saveSettings();

    if (
        notificationsRequested &&
        "Notification" in window &&
        Notification.permission !== "granted"
    ) {
        try {
            const permission =
                await Notification.requestPermission();

            if (permission !== "granted") {
                settings.notificationsEnabled =
                    false;

                notificationsEnabledInput.checked =
                    false;

                saveSettings();
            }
        } catch (error) {
            console.error(
                "Notification permission error:",
                error
            );

            settings.notificationsEnabled =
                false;

            notificationsEnabledInput.checked =
                false;

            saveSettings();
        }
    }

    if (!state.running) {
        const minutes =
            state.phase === "focus"
                ? settings.focusMinutes
                : settings.breakMinutes;

        state.remainingSeconds =
            minutes * 60;

        state.totalSeconds =
            minutes * 60;

        state.endTime = null;

        saveState();
    }

    render();

    settingsPanel.classList.add("hidden");
}


/* --------------------------------------------------
   State
-------------------------------------------------- */

function saveState() {
    localStorage.setItem(
        STATE_KEY,
        JSON.stringify(state)
    );
}

function loadState() {
    try {
        const saved =
            localStorage.getItem(STATE_KEY);

        if (!saved) {
            return;
        }

        const parsed =
            JSON.parse(saved);

        state = {
            ...state,
            ...parsed
        };

        if (
            state.running &&
            state.endTime
        ) {
            const remainingMilliseconds =
                state.endTime - Date.now();

            if (remainingMilliseconds <= 0) {
                completePhase();
                return;
            }

            state.remainingSeconds =
                Math.ceil(
                    remainingMilliseconds / 1000
                );

            startTimerInterval();
        }
    } catch (error) {
        console.error(
            "Failed to load state:",
            error
        );

        state = {
            phase: "focus",
            remainingSeconds:
                settings.focusMinutes * 60,
            totalSeconds:
                settings.focusMinutes * 60,
            running: false,
            completedPomodoros: 0,
            endTime: null
        };
    }
}


/* --------------------------------------------------
   Statistics
-------------------------------------------------- */

function loadStatistics() {
    try {
        const saved =
            localStorage.getItem(
                STATISTICS_KEY
            );

        if (!saved) {
            statistics = {};
            return;
        }

        statistics = JSON.parse(saved);

        if (
            !statistics ||
            typeof statistics !== "object"
        ) {
            statistics = {};
        }
    } catch (error) {
        console.error(
            "Failed to load statistics:",
            error
        );

        statistics = {};
    }
}

function saveStatistics() {
    localStorage.setItem(
        STATISTICS_KEY,
        JSON.stringify(statistics)
    );
}

function getTodayKey() {
    const now = new Date();

    const year =
        now.getFullYear();

    const month =
        String(now.getMonth() + 1)
            .padStart(2, "0");

    const day =
        String(now.getDate())
            .padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function getStatisticsForDate(dateKey) {
    if (!statistics[dateKey]) {
        statistics[dateKey] = {
            pomodoros: 0,
            focusMinutes: 0,
            breakMinutes: 0
        };
    }

    return statistics[dateKey];
}

function getTodayStatistics() {
    return getStatisticsForDate(
        getTodayKey()
    );
}

function recordCompletedFocus() {
    const today =
        getTodayStatistics();

    today.pomodoros += 1;

    today.focusMinutes +=
        settings.focusMinutes;

    saveStatistics();
}

function recordCompletedBreak() {
    const today =
        getTodayStatistics();

    today.breakMinutes +=
        settings.breakMinutes;

    saveStatistics();
}


/* --------------------------------------------------
   History
-------------------------------------------------- */

function parseDateKey(dateKey) {
    const [
        year,
        month,
        day
    ] = dateKey
        .split("-")
        .map(Number);

    return new Date(
        year,
        month - 1,
        day
    );
}

function getDateKeyDaysAgo(daysAgo) {
    const date = new Date();

    date.setHours(
        0,
        0,
        0,
        0
    );

    date.setDate(
        date.getDate() - daysAgo
    );

    const year =
        date.getFullYear();

    const month =
        String(date.getMonth() + 1)
            .padStart(2, "0");

    const day =
        String(date.getDate())
            .padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatHistoryDate(dateKey) {
    const date =
        parseDateKey(dateKey);

    const today =
        parseDateKey(
            getTodayKey()
        );

    const yesterday =
        parseDateKey(
            getDateKeyDaysAgo(1)
        );

    if (
        date.getTime() ===
        today.getTime()
    ) {
        return "Today";
    }

    if (
        date.getTime() ===
        yesterday.getTime()
    ) {
        return "Yesterday";
    }

    return date.toLocaleDateString(
        undefined,
        {
            weekday: "short",
            month: "short",
            day: "numeric"
        }
    );
}

function formatMinutes(minutes) {
    if (minutes <= 0) {
        return "0m";
    }

    const hours =
        Math.floor(minutes / 60);

    const remainingMinutes =
        minutes % 60;

    if (hours === 0) {
        return `${remainingMinutes}m`;
    }

    if (remainingMinutes === 0) {
        return `${hours}h`;
    }

    return `${hours}h ${remainingMinutes}m`;
}

function renderHistory() {
    const todayKey =
        getTodayKey();

    const history = [];

    for (let i = 0; i < 7; i++) {
        const dateKey =
            getDateKeyDaysAgo(i);

        const day =
            statistics[dateKey];

        if (!day) {
            continue;
        }

        const hasActivity =
            day.pomodoros > 0 ||
            day.focusMinutes > 0 ||
            day.breakMinutes > 0;

        if (!hasActivity) {
            continue;
        }

        history.push({
            dateKey,
            ...day
        });
    }

    if (history.length === 0) {
        historyListElement.innerHTML = `
            <div class="history-empty">
                No completed sessions yet.
            </div>
        `;

        return;
    }

    historyListElement.innerHTML =
        history
            .map((day) => {
                const isToday =
                    day.dateKey === todayKey;

                return `
                    <article class="history-item">

                        <div class="history-date ${
                            isToday
                                ? "history-today"
                                : ""
                        }">
                            ${formatHistoryDate(
                                day.dateKey
                            )}
                        </div>

                        <div class="history-stats">

                            <div class="history-stat">
                                <span
                                    class="history-stat-value"
                                >
                                    ${day.pomodoros}
                                </span>

                                <span
                                    class="history-stat-label"
                                >
                                    Pomodoros
                                </span>
                            </div>

                            <div class="history-stat">
                                <span
                                    class="history-stat-value"
                                >
                                    ${formatMinutes(
                                        day.focusMinutes
                                    )}
                                </span>

                                <span
                                    class="history-stat-label"
                                >
                                    Focus
                                </span>
                            </div>

                            <div class="history-stat">
                                <span
                                    class="history-stat-value"
                                >
                                    ${formatMinutes(
                                        day.breakMinutes
                                    )}
                                </span>

                                <span
                                    class="history-stat-label"
                                >
                                    Break
                                </span>
                            </div>

                        </div>

                    </article>
                `;
            })
            .join("");
}


/* --------------------------------------------------
   Timer
-------------------------------------------------- */

function getPhaseDurationSeconds() {
    if (state.phase === "focus") {
        return settings.focusMinutes * 60;
    }

    return settings.breakMinutes * 60;
}

function formatTime(seconds) {
    const safeSeconds =
        Math.max(
            0,
            Math.floor(seconds)
        );

    const minutes =
        Math.floor(
            safeSeconds / 60
        );

    const remainingSeconds =
        safeSeconds % 60;

    return `${String(minutes).padStart(
        2,
        "0"
    )}:${String(
        remainingSeconds
    ).padStart(2, "0")}`;
}

function startTimer() {
    if (state.running) {
        return;
    }

    if (state.remainingSeconds <= 0) {
        state.remainingSeconds =
            getPhaseDurationSeconds();

        state.totalSeconds =
            state.remainingSeconds;
    }

    state.endTime =
        Date.now() +
        state.remainingSeconds * 1000;

    state.running = true;

    saveState();

    startTimerInterval();

    render();
}

function startTimerInterval() {
    clearInterval(timerInterval);

    timerInterval =
        setInterval(
            updateTimer,
            250
        );
}

function updateTimer() {
    if (
        !state.running ||
        !state.endTime
    ) {
        return;
    }

    const remainingMilliseconds =
        state.endTime - Date.now();

    if (remainingMilliseconds <= 0) {
        state.remainingSeconds = 0;

        render();

        completePhase();

        return;
    }

    state.remainingSeconds =
        Math.ceil(
            remainingMilliseconds / 1000
        );

    render();
}

function pauseTimer() {
    if (!state.running) {
        return;
    }

    updateTimer();

    state.running = false;
    state.endTime = null;

    clearInterval(timerInterval);

    timerInterval = null;

    saveState();

    render();
}

function resetTimer() {
    clearInterval(timerInterval);

    timerInterval = null;

    state.running = false;
    state.endTime = null;

    state.remainingSeconds =
        getPhaseDurationSeconds();

    state.totalSeconds =
        state.remainingSeconds;

    saveState();

    render();
}

function skipPhase() {
    clearInterval(timerInterval);

    timerInterval = null;

    state.running = false;
    state.endTime = null;

    if (state.phase === "focus") {
        state.phase = "break";
    } else {
        state.phase = "focus";
    }

    state.remainingSeconds =
        getPhaseDurationSeconds();

    state.totalSeconds =
        state.remainingSeconds;

    saveState();

    render();
}

function completePhase() {
    clearInterval(timerInterval);

    timerInterval = null;

    state.running = false;
    state.endTime = null;

    if (state.phase === "focus") {
        recordCompletedFocus();

        state.completedPomodoros += 1;

        state.phase = "break";
    } else {
        recordCompletedBreak();

        state.phase = "focus";
    }

    state.remainingSeconds =
        getPhaseDurationSeconds();

    state.totalSeconds =
        state.remainingSeconds;

    saveState();

    playAlertSound();

    sendNotification();

    render();
}


/* --------------------------------------------------
   Audio
-------------------------------------------------- */

function playAlertSound() {
    if (!settings.soundEnabled) {
        return;
    }

    try {
        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioContext) {
            return;
        }

        const context =
            new AudioContext();

        const oscillator =
            context.createOscillator();

        const gain =
            context.createGain();

        oscillator.type = "sine";

        oscillator.frequency.value =
            880;

        gain.gain.setValueAtTime(
            0.0001,
            context.currentTime
        );

        gain.gain.exponentialRampToValueAtTime(
            0.25,
            context.currentTime + 0.02
        );

        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            context.currentTime + 0.5
        );

        oscillator.connect(gain);

        gain.connect(
            context.destination
        );

        oscillator.start();

        oscillator.stop(
            context.currentTime + 0.5
        );
    } catch (error) {
        console.error(
            "Audio notification failed:",
            error
        );
    }
}


/* --------------------------------------------------
   Notifications
-------------------------------------------------- */

function sendNotification() {
    if (
        !settings.notificationsEnabled ||
        !("Notification" in window)
    ) {
        return;
    }

    if (
        Notification.permission !==
        "granted"
    ) {
        return;
    }

    const title =
        state.phase === "break"
            ? "Focus session complete"
            : "Break complete";

    const body =
        state.phase === "break"
            ? "Time for a break."
            : "Ready to focus again.";

    try {
        new Notification(
            title,
            { body }
        );
    } catch (error) {
        console.error(
            "Notification failed:",
            error
        );
    }
}


/* --------------------------------------------------
   Rendering
-------------------------------------------------- */

function render() {
    timerElement.textContent =
        formatTime(
            state.remainingSeconds
        );

    phaseLabelElement.textContent =
        state.phase === "focus"
            ? "Focus"
            : "Break";

    const progress =
        state.totalSeconds > 0
            ? state.remainingSeconds /
              state.totalSeconds
            : 0;

    progressElement.style.transform =
        `scaleX(${Math.max(
            0,
            progress
        )})`;

    startButton.textContent =
        state.running
            ? "Pause"
            : "Start";

    completedPomodorosElement.textContent =
        state.completedPomodoros;

    renderStatistics();

    renderHistory();
}

function renderStatistics() {
    const today =
        getTodayStatistics();

    todayPomodorosElement.textContent =
        today.pomodoros;

    todayFocusElement.textContent =
        formatMinutes(
            today.focusMinutes
        );

    todayBreakElement.textContent =
        formatMinutes(
            today.breakMinutes
        );

    saveStatistics();
}


/* --------------------------------------------------
   Event Listeners
-------------------------------------------------- */

startButton.addEventListener(
    "click",
    () => {
        if (state.running) {
            pauseTimer();
        } else {
            startTimer();
        }
    }
);

resetButton.addEventListener(
    "click",
    resetTimer
);

skipButton.addEventListener(
    "click",
    skipPhase
);

settingsButton.addEventListener(
    "click",
    () => {
        populateSettingsForm();

        settingsPanel.classList.remove(
            "hidden"
        );
    }
);

closeSettingsButton.addEventListener(
    "click",
    () => {
        settingsPanel.classList.add(
            "hidden"
        );
    }
);

saveSettingsButton.addEventListener(
    "click",
    applySettings
);


/* --------------------------------------------------
   Page Visibility
-------------------------------------------------- */

document.addEventListener(
    "visibilitychange",
    () => {
        if (document.hidden) {
            saveState();
            return;
        }

        if (
            state.running &&
            state.endTime
        ) {
            const remainingMilliseconds =
                state.endTime - Date.now();

            if (remainingMilliseconds <= 0) {
                completePhase();
                return;
            }

            state.remainingSeconds =
                Math.ceil(
                    remainingMilliseconds / 1000
                );
        }

        render();
    }
);


/* --------------------------------------------------
   PWA Service Worker
-------------------------------------------------- */

if ("serviceWorker" in navigator) {
    window.addEventListener(
        "load",
        async () => {
            try {
                const registration =
                    await navigator.serviceWorker.register(
                        "./sw.js",
                        {
                            scope: "./"
                        }
                    );

                console.log(
                    "FAK Pomodoro service worker registered:",
                    registration.scope
                );
            } catch (error) {
                console.error(
                    "Service worker registration failed:",
                    error
                );
            }
        }
    );
}


/* --------------------------------------------------
   Initialization
-------------------------------------------------- */

loadStatistics();

loadState();

populateSettingsForm();

render();