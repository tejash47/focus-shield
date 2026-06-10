const DEFAULT_BLOCKED = ["youtube.com","instagram.com","reddit.com","facebook.com"];

// Check if current time falls within any saved break window
function isInBreakWindow(windows) {
  if (!windows || !windows.length) return false;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  for (const bw of windows) {
    if (!bw.start || !bw.end) continue;
    const [sh, sm] = bw.start.split(':').map(Number);
    const [eh, em] = bw.end.split(':').map(Number);
    const s = sh * 60 + sm, e = eh * 60 + em;
    if (s < e ? (cur >= s && cur <= e) : (cur >= s || cur <= e)) return true;
  }
  return false;
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  if (tab.url.startsWith("chrome-extension://") || tab.url.startsWith("chrome://")) return;

  const data = await chrome.storage.local.get([
    'shieldActive', 'hardcoreFocus', 'pomoAutoBlock',
    'blockedSites', 'pomoState', 'breakWindows'
  ]);

  if (data.shieldActive === false) return;
  if (data.pomoAutoBlock && data.pomoState !== 'running') return;
  if (isInBreakWindow(data.breakWindows)) return;

  const BLOCKED = data.blockedSites || DEFAULT_BLOCKED;
  const hostname = new URL(tab.url).hostname.replace("www.", "");
  if (!BLOCKED.some(s => hostname.includes(s))) return;

  // Check 2-min bypass timer
  const bypassData = await chrome.storage.local.get('bypass_' + hostname);
  const expiry = bypassData['bypass_' + hostname];
  if (expiry && Date.now() < expiry) return;

  // Block it — redirect to focus page
  const encodedUrl = encodeURIComponent(tab.url);
  chrome.tabs.update(tabId, { url: chrome.runtime.getURL(`focus.html?url=${encodedUrl}`) });
});
