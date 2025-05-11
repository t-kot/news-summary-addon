// popup.js
// ... (既存のグローバル変数や関数定義は変更なし)

const SVG_BOOKMARK_STAR = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-bookmark-star" viewBox="0 0 16 16">
<path d="M7.84 4.1a.178.178 0 0 1 .32 0l.634 1.285a.18.18 0 0 0 .134.098l1.42.206c.145.021.204.2.098.303L9.42 6.993a.18.18 0 0 0-.051.158l.242 1.414a.178.178 0 0 1-.258.187l-1.27-.668a.18.18 0 0 0-.165 0l-1.27.668a.178.178 0 0 1-.257-.187l.242-1.414a.18.18 0 0 0-.05-.158l-1.03-1.001a.178.178 0 0 1 .098-.303l1.42-.206a.18.18 0 0 0 .134-.098z"/>
<path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v13.5a.5.5 0 0 1-.777.416L8 13.101l-5.223 2.815A.5.5 0 0 1 2 15.5zm2-1a1 1 0 0 0-1 1v12.566l4.723-2.482a.5.5 0 0 1 .554 0L13 14.566V2a1 1 0 0 0-1-1z"/>
</svg>`;

const SVG_BOOKMARK_STAR_FILL = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-bookmark-star-fill" viewBox="0 0 16 16">
<path fill-rule="evenodd" d="M2 15.5V2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v13.5a.5.5 0 0 1-.74.439L8 13.069l-5.26 2.87A.5.5 0 0 1 2 15.5M8.16 4.1a.178.178 0 0 0-.32 0l-.634 1.285a.18.18 0 0 1-.134.098l-1.42.206a.178.178 0 0 0-.098.303L6.58 6.993c.042.041.061.1.051.158L6.39 8.565a.178.178 0 0 0 .258.187l1.27-.668a.18.18 0 0 1 .165 0l1.27.668a.178.178 0 0 0 .257-.187L9.368 7.15a.18.18 0 0 1 .05-.158l1.028-1.001a.178.178 0 0 0-.098-.303l-1.42-.206a.18.18 0 0 1-.134-.098z"/>
</svg>`;

const SVG_RELOAD = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-clockwise" viewBox="0 0 16 16">
  <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/>
  <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/>
</svg>`;

const SVG_SETTINGS = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-gear-fill" viewBox="0 0 16 16">
  <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"/>
</svg>`;

const SVG_LIST_STARS = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-list-stars" viewBox="0 0 16 16">
  <path fill-rule="evenodd" d="M5 11.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5"/>
  <path d="M2.242 2.194a.27.27 0 0 1 .516 0l.162.53c.035.115.14.194.258.194h.551c.259 0 .37.333.164.493l-.468.363a.28.28 0 0 0-.094.3l.173.569c.078.256-.213.462-.423.3l-.417-.324a.27.27 0 0 0-.328 0l-.417.323c-.21.163-.5-.043-.423-.299l.173-.57a.28.28 0 0 0-.094-.299l-.468-.363c-.206-.16-.095-.493.164-.493h.55a.27.27 0 0 0 .259-.194zm0 4a.27.27 0 0 1 .516 0l.162.53c.035.115.14.194.258.194h.551c.259 0 .37.333.164.493l-.468.363a.28.28 0 0 0-.094.3l.173.569c.078.255-.213.462-.423.3l-.417-.324a.27.27 0 0 0-.328 0l-.417.323c-.21.163-.5-.043-.423-.299l.173-.57a.28.28 0 0 0-.094-.299l-.468-.363c-.206-.16-.095-.493.164-.493h.55a.27.27 0 0 0 .259-.194zm0 4a.27.27 0 0 1 .516 0l.162.53c.035.115.14.194.258.194h.551c.259 0 .37.333.164.493l-.468.363a.28.28 0 0 0-.094.3l.173.569c.078.255-.213.462-.423.3l-.417-.324a.27.27 0 0 0-.328 0l-.417.323c-.21.163-.5-.043-.423-.299l.173-.57a.28.28 0 0 0-.094-.299l-.468-.363c-.206-.16-.095-.493.164-.493h.55a.27.27 0 0 0 .259-.194z"/>
</svg>`;

// 現在のページのURLを保持するためのグローバル変数（のようなもの、DOMContentLoaded内で設定）
let currentTabInfo = { url: null, title: null, id: null, pageText: null, actualPageTitle: null };

document.addEventListener('DOMContentLoaded', async () => {
  document.body.classList.remove('large-popup');
  document.body.classList.add('small-popup');
  // const resultDiv = document.getElementById('result'); // showErrorなどで直接使うのでここでは不要かも
  // resultDiv.classList.remove('large-result');
  // resultDiv.classList.add('small-result');

  showLoadingUI();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.id || !tab.url) {
    showError('アクティブなタブの情報が取得できませんでした。');
    disableHeaderButtonsOnError(true);
    return;
  }
  currentTabInfo = { url: tab.url, title: tab.title, id: tab.id };

  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    showError('この拡張機能は通常のウェブページでのみ動作します。');
    disableHeaderButtonsOnError(true);
    return;
  }

  updateClipButtonStatus(tab.url); // 星アイコンの状態更新

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({
      pageUrl: location.href,
      pageTitle: document.title,
      pageText: document.body.innerText
    })
  }, (injectionResults) => {
    if (chrome.runtime.lastError || !injectionResults || !injectionResults[0] || !injectionResults[0].result) {
      showError('ページ情報の取得に失敗しました。');
      disableHeaderButtonsOnError(true);
      return;
    }
    const { pageUrl, pageTitle, pageText } = injectionResults[0].result;
    currentTabInfo.pageText = pageText;
    currentTabInfo.actualPageTitle = pageTitle;
    requestSummary(pageUrl, pageTitle, pageText, false, tab.id);
    // ページ情報取得後はヘッダーボタンを有効化（ローディング中も操作は可能にする）
    disableHeaderButtonsOnError(false);
  });

  // ヘッダーボタンのSVGアイコン設定
  const headerClipButton = document.getElementById('headerClipBtn');
  if (headerClipButton) headerClipButton.innerHTML = SVG_BOOKMARK_STAR; // 初期は未クリップ

  const headerViewClipsBtn = document.getElementById('headerViewClipsBtn'); // HTML側でこのIDのボタンを追加する必要あり
  if (headerViewClipsBtn) headerViewClipsBtn.innerHTML = SVG_LIST_STARS;

  const headerReloadButton = document.getElementById('headerReloadBtn');
  if (headerReloadButton) headerReloadButton.innerHTML = SVG_RELOAD;

  const headerSettingsButton = document.getElementById('headerSettingsBtn');
  if (headerSettingsButton) headerSettingsButton.innerHTML = SVG_SETTINGS;
  
  // updateClipButtonStatus(tab.url); // これはtab情報取得後に呼び出すのでこの位置でOK

  // --- ヘッダーボタンの処理 ---
  // const headerClipButton = document.getElementById('headerClipBtn'); // 上で取得済み
  headerClipButton.addEventListener('click', async () => {
    if (!currentTabInfo.url || !currentTabInfo.id || !currentTabInfo.pageText) {
      console.warn("クリップ対象の情報が不十分です (URL/ID/本文)");
      return;
    }
    const resultDiv = document.getElementById('result');
    const summaryHtmlFromDOM = resultDiv.innerHTML; // 成功時のHTMLを想定
    const translatedTitleElement = resultDiv.querySelector('#copy-title-text');
    const translatedTitle = translatedTitleElement ? translatedTitleElement.innerText : currentTabInfo.actualPageTitle;

    const clipData = {
      url: currentTabInfo.url,
      title: translatedTitle,
      summaryHtml: summaryHtmlFromDOM,
      pageBodyText: currentTabInfo.pageText,
      timestamp: new Date().toISOString()
    };

    chrome.runtime.sendMessage({ action: "isUrlClipped", data: { url: currentTabInfo.url } }, (responseIsClipped) => {
      if (responseIsClipped && responseIsClipped.isClipped) {
        chrome.runtime.sendMessage({ action: "deleteClip", data: { url: currentTabInfo.url } }, (responseDelete) => {
          if (responseDelete && responseDelete.success) updateClipButtonStatus(currentTabInfo.url, false);
          else console.error("クリップ削除失敗: ", responseDelete?.error);
        });
      } else {
        chrome.runtime.sendMessage({ action: "addClip", data: clipData }, (responseAdd) => {
          if (responseAdd && responseAdd.success) updateClipButtonStatus(currentTabInfo.url, true);
          else console.error("クリップ追加失敗: ", responseAdd?.error);
        });
      }
    });
  });

  // 「クリップ一覧」ボタンの処理 (ヘッダーに移動)
  // const headerViewClipsBtn = document.getElementById('headerViewClipsBtn'); // 上で取得済み
  if (headerViewClipsBtn) {
    headerViewClipsBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('clips.html') });
    });
  }

  // const headerReloadButton = document.getElementById('headerReloadBtn'); // 上で取得済み
  headerReloadButton.addEventListener('click', async () => {
    if (!currentTabInfo.id || !currentTabInfo.url || currentTabInfo.url.startsWith('chrome://') || currentTabInfo.url.startsWith('chrome-extension://')){
      showError('このページでは再読み込みできません。');
      return;
    }
    showLoadingUI();
    // ページ情報はcurrentTabInfoから再利用 (scripting.executeScriptは初回のみで良い場合が多い)
    // 必要なら再度executeScriptで取得も可能
    requestSummary(currentTabInfo.url, currentTabInfo.actualPageTitle, currentTabInfo.pageText, true, currentTabInfo.id);
  });
  
  // const headerSettingsButton = document.getElementById('headerSettingsBtn'); // 上で取得済み
  if(headerSettingsButton){
    headerSettingsButton.addEventListener('click', () => {
      chrome.runtime.openOptionsPage(); // オプションページを開く
    });
  }

  // 「ページ全体をコピー」リンクの処理 (フッターに復活させるため、ここでリスナー設定)
  const footerCopyPageTextLink = document.getElementById('footerCopyPageTextLink'); // HTML側でこのIDのリンクを追加する必要あり
  if (footerCopyPageTextLink) {
    footerCopyPageTextLink.addEventListener('click', async (event) => {
      event.preventDefault(); // リンクのデフォルト動作を防ぐ
      // ... (既存のページ全体コピーのロジックをここに移植)
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://'))) {
          // 簡易的なフィードバック
          const originalText = footerCopyPageTextLink.textContent;
          footerCopyPageTextLink.textContent = '利用不可';
          setTimeout(() => { footerCopyPageTextLink.textContent = originalText; }, 2000);
          return;
        }
        chrome.scripting.executeScript(
          { target: { tabId: tab.id }, func: () => document.body.innerText }, 
          async (injectionResults) => {
            const originalText = footerCopyPageTextLink.textContent;
            if (chrome.runtime.lastError || !injectionResults || !injectionResults[0] || !injectionResults[0].result) {
              console.error("ページテキスト取得失敗:", chrome.runtime.lastError?.message);
              footerCopyPageTextLink.textContent = '取得失敗';
              setTimeout(() => { footerCopyPageTextLink.textContent = originalText; }, 2000);
              return;
            }
            const pageText = injectionResults[0].result;
            try {
              await navigator.clipboard.writeText(pageText);
              footerCopyPageTextLink.textContent = 'Copied!';
              setTimeout(() => { footerCopyPageTextLink.textContent = originalText; }, 1500);
            } catch (err) {
              console.error('クリップボードコピー失敗:', err);
              footerCopyPageTextLink.textContent = 'コピー失敗';
              setTimeout(() => { footerCopyPageTextLink.textContent = originalText; }, 1500);
            }
          }
        );
      } else {
        const originalText = footerCopyPageTextLink.textContent;
        footerCopyPageTextLink.textContent = 'タブなし';
        setTimeout(() => { footerCopyPageTextLink.textContent = originalText; }, 1500);
      }
    });
  }
});

async function updateClipButtonStatus(url, forceState = null) {
  const clipButton = document.getElementById('headerClipBtn');
  if (!clipButton) return;

  const setButtonState = (isClipped) => {
    if (isClipped) {
      clipButton.innerHTML = SVG_BOOKMARK_STAR_FILL;
      clipButton.classList.add('clipped');
      clipButton.title = 'クリップを解除';
    } else {
      clipButton.innerHTML = SVG_BOOKMARK_STAR;
      clipButton.classList.remove('clipped');
      clipButton.title = 'この記事をクリップ';
    }
  };

  if (forceState !== null) {
    setButtonState(forceState);
    return;
  }
  if (!url) {
    setButtonState(false);
    return;
  }

  chrome.runtime.sendMessage({ action: "isUrlClipped", data: { url } }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn("isUrlClipped応答エラー: ", chrome.runtime.lastError.message);
      clipButton.innerHTML = SVG_BOOKMARK_STAR; // エラー時はデフォルト（未クリップ）表示
      // clipButton.disabled = true; // disableHeaderButtonsOnErrorで制御
      return;
    }
    if (response) setButtonState(response.isClipped);
    else { 
      clipButton.innerHTML = SVG_BOOKMARK_STAR; // 応答なしの場合もデフォルト
      // clipButton.disabled = true;
    }
  });
}

function disableHeaderButtonsOnError(disable) {
    const clipButton = document.getElementById('headerClipBtn');
    const reloadButton = document.getElementById('headerReloadBtn');
    const settingsButton = document.getElementById('headerSettingsBtn'); 

    if (clipButton) {
        clipButton.disabled = disable;
        if(disable) { // エラー時は未クリップ状態のSVGに戻す
            clipButton.innerHTML = SVG_BOOKMARK_STAR;
            clipButton.classList.remove('clipped');
        }
    }
    if (reloadButton) reloadButton.disabled = disable;
    if (settingsButton && disable) { 
        // settingsButton.disabled = disable;
    } 
}

function requestSummary(pageUrl, pageTitle, pageText, forceReload, tabId) {
  chrome.runtime.sendMessage(
    { action: "getSummary", data: { pageUrl, pageTitle, pageText, forceReload, tabId } },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error sending message to background:", chrome.runtime.lastError.message);
        showError("バックグラウンド処理との連携に失敗しました。");
        return;
      }
      handleBackgroundResponse(response, pageUrl, pageTitle, pageText, tabId);
    }
  );
}

function handleBackgroundResponse(response, pageUrl, pageTitle, pageText, tabId) {
  if (!response) {
      showError("バックグラウンドからの応答がありません。", pageUrl, pageTitle, pageText, tabId);
      return;
  }
  switch (response.status) {
    case 'loading':
      showLoadingUI();
      break;
    case 'success':
      showResultHtml(response.data);
      break;
    case 'error':
      showError(response.error || '不明なエラーが発生しました。', pageUrl, pageTitle, pageText, tabId);
      break;
    default:
      if(response.error){
        showError(response.error, pageUrl, pageTitle, pageText, tabId);
      } else {
        console.error("Unknown response from background:", response);
        showError('バックグラウンドから予期しない応答がありました。', pageUrl, pageTitle, pageText, tabId);
      }
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "summaryUpdated") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id === request.tabIdForIcon && tabs[0].url === request.forUrl) {
            handleBackgroundResponse(request, request.forUrl, null, null, request.tabIdForIcon);
        }
    });
  }
});

function showLoadingUI() {
  document.body.classList.remove('large-popup');
  document.body.classList.add('small-popup');
  const resultDiv = document.getElementById('result');
  resultDiv.innerHTML = `
    <div class="loading-container">
      <svg width="60" height="60" viewBox="0 0 50 50">
        <circle cx="25" cy="25" r="20" fill="none" stroke="#4f8cff" stroke-width="5" stroke-linecap="round" stroke-dasharray="31.4 31.4" transform="rotate(-90 25 25)">
          <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite"/>
        </circle>
      </svg>
      <div class="loading-text">翻訳・要約を取得中...</div>
    </div>
  `;
  // ローディング中はヘッダーボタンを一旦無効化しても良いが、クリップ状態確認は走る
  // disableHeaderButtonsOnError(true);
}

function showResultHtml(html) {
  document.body.classList.remove('small-popup');
  document.body.classList.add('large-popup');
  const resultDiv = document.getElementById('result');
  resultDiv.innerHTML = html;
  // 結果表示後、ヘッダーボタンを有効化
  disableHeaderButtonsOnError(false);
  // クリップ状態も再確認・更新
  if(currentTabInfo.url) updateClipButtonStatus(currentTabInfo.url);

  const copyButtons = resultDiv.querySelectorAll('.copy-button');
  copyButtons.forEach(button => {
    button.addEventListener('click', async () => {
      const targetId = button.dataset.clipboardTarget;
      const targetElement = resultDiv.querySelector(targetId);
      if (targetElement) {
        try {
          await navigator.clipboard.writeText(targetElement.innerText);
          button.textContent = 'Copied!';
          button.classList.add('copied');
          setTimeout(() => {
            button.textContent = 'コピー';
            button.classList.remove('copied');
          }, 1500);
        } catch (err) {
          console.error('クリップボードへのコピーに失敗しました:', err);
          button.textContent = '失敗';
          setTimeout(() => { button.textContent = 'コピー'; }, 1500);
        }
      }
    });
  });
}

function showError(message, pageUrl, pageTitle, pageText, tabId) {
  document.body.classList.remove('small-popup');
  document.body.classList.add('large-popup');
  const resultDiv = document.getElementById('result');
  resultDiv.innerHTML = `<div style="padding: 20px; color:#c00; font-weight:bold;">${message}</div>`;
  // エラー時はヘッダーの再読み込みボタンのみ有効化、クリップは不可にするなど検討
  disableHeaderButtonsOnError(true); // 基本は無効化
  const reloadButton = document.getElementById('headerReloadBtn');
  if (reloadButton && pageUrl && tabId) { // 再試行可能なエラーの場合のみ再読み込みボタンを有効化
      reloadButton.disabled = false;
  }
} 