// VerifyX Extension Service Worker (Manifest V3)

chrome.runtime.onInstalled.addListener(() => {
  // Create Context Menus
  chrome.contextMenus.create({
    id: "verify-text",
    title: "Verify Selected Text with VerifyX",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "verify-link",
    title: "Scan URL Trust with VerifyX",
    contexts: ["link"]
  });

  chrome.contextMenus.create({
    id: "verify-page",
    title: "Analyze Page Safety",
    contexts: ["page"]
  });
});

// Context Menu Action Listeners
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "verify-text") {
    const selectedText = info.selectionText;
    chrome.storage.local.set({ lastSelectedText: selectedText }, () => {
      chrome.action.openPopup ? chrome.action.openPopup() : console.log("Text cached. Open VerifyX extension to analyze.");
    });
  } else if (info.menuItemId === "verify-link") {
    const linkUrl = info.linkUrl;
    chrome.storage.local.set({ lastSelectedUrl: linkUrl }, () => {
      chrome.action.openPopup ? chrome.action.openPopup() : console.log("URL cached. Open VerifyX extension to analyze.");
    });
  } else if (info.menuItemId === "verify-page") {
    const pageUrl = info.pageUrl;
    chrome.storage.local.set({ lastSelectedUrl: pageUrl }, () => {
      chrome.action.openPopup ? chrome.action.openPopup() : console.log("Page link cached. Open VerifyX extension to analyze.");
    });
  }
});
