const APP_PAGE = "index.html";

chrome.action.onClicked.addListener(async () => {
  const appUrl = chrome.runtime.getURL(APP_PAGE);
  const tabs = await chrome.tabs.query({ url: `${appUrl}*` });
  const existingTab = tabs.find((tab) => tab.id !== undefined);

  if (existingTab?.id !== undefined) {
    await chrome.tabs.update(existingTab.id, { active: true });
    if (existingTab.windowId !== undefined) {
      await chrome.windows.update(existingTab.windowId, { focused: true });
    }
    return;
  }

  await chrome.tabs.create({ url: appUrl });
});
