// client/src/services/api.js
export async function fetchForecast(satId, hours = 2) {
    const now = Date.now();
    const res = await fetch(
        `/api/forecast/${satId}?start=${now}&end=${now + hours * 3600 * 1000}`
    );
    if (!res.ok) throw new Error(res.statusText);
    return res.json(); // [{ ts, lon, lat, alt }, ...]
}

// You could add fetchLivePosition, fetchMetadata, etc. here later
// client/src/services/api.js
export async function fetchLaunchHistory() {
    const res = await fetch('/api/launch-history');
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
}
