let apiResultsCache = {};
let apiRequestStatus = {}; // { [url]: 'loading' | 'error' | 'success' }

// アイコンパス定義
const ICONS = {
  default: {
    "16": "icons/icon_default_16.png",
    // "32": "icons/icon_default_32.png", // 削除
    "48": "icons/icon_default_48.png",
    "128": "icons/icon_default_128.png"
  },
  loading: {
    "16": "icons/icon_loading_16.png",
    // "32": "icons/icon_loading_32.png", // 削除
    "48": "icons/icon_loading_48.png",
    "128": "icons/icon_loading_128.png"
  },
  success: {
    "16": "icons/icon_success_16.png",
    // "32": "icons/icon_success_32.png", // 削除
    "48": "icons/icon_success_48.png",
    "128": "icons/icon_success_128.png"
  },
  error: {
    "16": "icons/icon_error_16.png",
    // "32": "icons/icon_error_32.png", // 削除
    "48": "icons/icon_error_48.png",
    "128": "icons/icon_error_128.png"
  }
};

// キャッシュキーのプレフィックス変更
const CACHE_KEY_PREFIX = 'article_summary_';

// background.js の先頭の方で設定キーを定義
const SETTINGS_API_KEY = 'geminiApiKey';
const SETTINGS_MODEL = 'geminiModel';
const DEFAULT_MODEL = 'gemini-2.0-flash'; // APIキー未設定時のフォールバックや初期値

// グローバル変数としてAPIキーとモデルを保持（起動時や設定変更時に更新）
let currentApiKey = null;
let currentModel = DEFAULT_MODEL;

// 設定をストレージから読み込む関数
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([SETTINGS_API_KEY, SETTINGS_MODEL], (settings) => {
      if (chrome.runtime.lastError) {
        console.error("[Settings] 設定の読み込みに失敗:", chrome.runtime.lastError.message);
        // エラー時もデフォルト値で解決するが、APIキーがないと機能しない
        currentApiKey = null;
        currentModel = DEFAULT_MODEL;
        resolve();
        return;
      }
      currentApiKey = settings[SETTINGS_API_KEY] || null;
      currentModel = settings[SETTINGS_MODEL] || DEFAULT_MODEL;
      console.log("[Settings] 設定を読み込みました:", { apiKey: currentApiKey ? '****' : null, model: currentModel });
      resolve();
    });
  });
}

// 拡張機能起動時に設定を読み込む
(async () => {
  await loadSettings();
})();

// 設定変更をリッスンして動的に反映 (options.jsから変更通知が来た場合)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    let settingsChanged = false;
    if (changes[SETTINGS_API_KEY]) {
      currentApiKey = changes[SETTINGS_API_KEY].newValue || null;
      settingsChanged = true;
      console.log("[Settings] APIキーが変更されました。");
    }
    if (changes[SETTINGS_MODEL]) {
      currentModel = changes[SETTINGS_MODEL].newValue || DEFAULT_MODEL;
      settingsChanged = true;
      console.log("[Settings] モデルが変更されました: ", currentModel);
    }
    // 必要であれば、設定変更後に何かアクション（例: アイコン更新など）を行う
  }
});

async function updateIconForTab(tabId, tabUrl) {
  if (!tabId) { // tabId がない場合は何もしない
    // console.warn("updateIconForTab: tabId is missing");
    return;
  }
  if (!tabUrl || tabUrl.startsWith('chrome://') || tabUrl.startsWith('chrome-extension://')) {
    try {
      await chrome.action.setIcon({ path: ICONS.default, tabId: tabId });
    } catch (e) { /* console.warn(`Failed to set default icon for tab ${tabId}: ${e.message}`); */ }
    return;
  }
  const cacheKey = CACHE_KEY_PREFIX + tabUrl;
  const status = apiRequestStatus[cacheKey];
  let iconPath = ICONS.default;

  if (status === 'loading') {
    iconPath = ICONS.loading;
  } else if (status === 'success' && apiResultsCache[cacheKey]) {
    iconPath = ICONS.success;
  } else if (status === 'error') {
    iconPath = ICONS.error;
  }
  try {
    await chrome.action.setIcon({ path: iconPath, tabId: tabId });
  } catch (e) { /* console.warn(`Failed to set icon for tab ${tabId}: ${e.message}`); */ }
}

chrome.tabs.onActivated.addListener(activeInfo => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError) { console.warn(chrome.runtime.lastError.message); return; }
    if (tab && tab.url) {
        updateIconForTab(activeInfo.tabId, tab.url);
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // statusがcompleteになったとき、またはURLが変わったときにアイコンを更新
  if (changeInfo.status === 'complete' || changeInfo.url) {
    if (tab.url) {
        updateIconForTab(tabId, tab.url);
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getSummary") {
    if (!currentApiKey) {
      console.error("[API] Gemini APIキーが設定されていません。オプションページで設定してください。");
      sendResponse({ status: 'error', error: "APIキーが未設定です。拡張機能のオプションページで設定してください。" });
      // アイコンをエラー状態にするなどしても良い
      const { tabId, pageUrl } = request.data;
      if (tabId && pageUrl) {
        apiRequestStatus[CACHE_KEY_PREFIX + pageUrl] = 'error';
        updateIconForTab(tabId, pageUrl);
      }
      return true; // trueを返してレスポンスが非同期であることを示す
    }
    const { pageUrl, pageTitle, pageText, forceReload, tabId } = request.data;

    if (!pageUrl) {
      sendResponse({ error: "ページ情報が取得できませんでした。" });
      return true;
    }
    const cacheKey = CACHE_KEY_PREFIX + pageUrl;

    if (forceReload) {
      // forceReloadがtrueの場合、キャッシュや既存ステータスに関わらず、まずローディング状態にする
      console.log(`Force reloading for tabId: ${tabId}, url: ${pageUrl}`);
      apiRequestStatus[cacheKey] = 'loading';
      updateIconForTab(tabId, pageUrl); // 即座にローディングアイコンに更新
      // この後、API呼び出し処理に進むため、ポップアップへのレスポンスはfetch直前のsendResponse({ status: 'loading' })で対応
    } else {
      // forceReloadがfalseの場合、既存のロジックでキャッシュやステータスを確認
      updateIconForTab(tabId, pageUrl); // 現在の状態に基づいてアイコンを設定

      if (apiResultsCache[cacheKey]) {
        sendResponse({ status: 'success', data: apiResultsCache[cacheKey] });
        apiRequestStatus[cacheKey] = 'success';
        updateIconForTab(tabId, pageUrl);
        return true;
      }
      if (apiRequestStatus[cacheKey] === 'loading') {
        sendResponse({ status: 'loading' });
        updateIconForTab(tabId, pageUrl);
        return true;
      }
    }

    // API呼び出し処理（forceReload=true の場合、または初回アクセスの場合）
    // ステータスとアイコンは forceReload分岐で既に設定されているか、ここで設定される
    if (apiRequestStatus[cacheKey] !== 'loading') { // まだローディングに設定されていなければ設定
        apiRequestStatus[cacheKey] = 'loading';
        updateIconForTab(tabId, pageUrl); 
    }
    sendResponse({ status: 'loading' }); // ポップアップにローディング状態を通知 (必須)

    fetchSummaryFromGemini(pageUrl, pageTitle, pageText, cacheKey)
      .then(html => {
        apiResultsCache[cacheKey] = html;
        apiRequestStatus[cacheKey] = 'success';
        saveCacheToStorage();
        updateIconForTab(tabId, pageUrl);
        chrome.runtime.sendMessage({ action: "summaryUpdated", status: 'success', data: html, forUrl: pageUrl, tabIdForIcon: tabId }, response => {
          if (chrome.runtime.lastError) {
            // console.log("[BG] summaryUpdated (success) 応答なし: ポップアップ非表示の可能性: ", chrome.runtime.lastError.message);
          }
        });
      })
      .catch(error => {
        apiRequestStatus[cacheKey] = 'error';
        updateIconForTab(tabId, pageUrl);
        chrome.runtime.sendMessage({ action: "summaryUpdated", status: 'error', error: error.message, forUrl: pageUrl, tabIdForIcon: tabId }, response => {
          if (chrome.runtime.lastError) {
            // console.log("[BG] summaryUpdated (error) 応答なし: ポップアップ非表示の可能性: ", chrome.runtime.lastError.message);
          }
        });
      });

    return true; // Indicate that the response will be sent asynchronously
  }

  if (request.action === "addClip") {
    addClip(request.data).then(sendResponse);
    // クリップ追加成功をポップアップに通知する場合 (任意)
    // chrome.runtime.sendMessage({ action: "clipStatusUpdated", url: request.data.url, isClipped: true }, response => { if (chrome.runtime.lastError) {} });
    return true; 
  }

  if (request.action === "deleteClip") {
    deleteClip(request.data.url).then(sendResponse);
    // クリップ削除成功をポップアップに通知する場合 (任意)
    // chrome.runtime.sendMessage({ action: "clipStatusUpdated", url: request.data.url, isClipped: false }, response => { if (chrome.runtime.lastError) {} });
    return true; 
  }

  if (request.action === "getAllClips") {
    getAllClips().then(sendResponse);
    return true; // 非同期応答
  }

  if (request.action === "isUrlClipped") {
    isUrlClipped(request.data.url).then(isClipped => sendResponse({ isClipped }));
    return true; // 非同期応答
  }

  // キャッシュクリアのアクション
  if (request.action === "clearAllCache") {
    console.log("[Cache] 全キャッシュクリア処理を開始します。");
    apiResultsCache = {}; // メモリキャッシュクリア
    apiRequestStatus = {}; // ステータスもクリア
    savedClips = {}; // クリップもクリア
    try {
      chrome.storage.local.clear(() => { // ストレージ全体のクリア
        if (chrome.runtime.lastError) {
          console.error("[Cache] ストレージのクリアに失敗:", chrome.runtime.lastError.message);
          sendResponse({ success: false, error: "ストレージのクリアに失敗しました。" });
        } else {
          console.log("[Cache] ストレージを正常にクリアしました。");
          // 念のため、クリア後に空のオブジェクトで再初期化
          saveClipsToStorage(); // 空のクリップを保存
          saveCacheToStorage(); // 空の要約キャッシュ情報を保存 (saveCacheToStorageの実装が必要)
          sendResponse({ success: true, message: "全てのキャッシュとクリップをクリアしました。" });
          // 必要であれば全タブのアイコンをデフォルトに戻すなど
        }
      });
    } catch (e) {
        console.error("[Cache] ストレージクリア中に例外発生:", e);
        sendResponse({ success: false, error: "キャッシュクリア中に例外が発生しました。" });
    }
    return true; // 非同期応答
  }

  // 他のメッセージタイプがある場合は、ここで処理を継続
  // return true; を適切に管理する
});

async function fetchSummaryFromGemini(pageUrl, pageTitle, pageText, cacheKey) {
  // APIキーとモデル名をグローバル変数から使用
  if (!currentApiKey) {
    throw new Error("APIキーが設定されていません。");
  }
  const geminiApiKey = currentApiKey;
  const modelToUse = currentModel;
  console.log(`[API] Using model: ${modelToUse}`);

  const prompt = `次の情報はウェブページから取得したものです。\n\n【title】\n${pageTitle}\n\n【本文テキスト（ノイズ含む）】\n${pageText}\n\n指示:\n1. titleを日本語に翻訳してください。(もし元が日本語の場合はそのままで良い)\n2. 本文テキストの内容を、記事全体の流れ（導入、主要な出来事や議論、結論など）が明確にわかるように、詳細な日本語で要約してください。文字数制限は特に設けませんが、冗長にならないよう留意してください。\n3. 本文テキストで言及されている主要なトピックや出来事について、記事中では直接的に説明されていない可能性のある背景知識、関連する事実、または理解を助ける前提条件を、3～5個程度選び出し、それぞれについて100～150字程度の日本語で解説してください。各項目は「・【解説対象のトピックや出来事】: （ここに関連知識や背景の解説）」の形式で記述してください。\n\n出力は必ず以下の形式で、各セクションの間に「---」を入れてください：\n翻訳タイトル:（ここに翻訳タイトル）\n---\n詳細要約:\n（ここに記事全体の流れがわかる詳細な要約）\n---\n背景知識と前提の解説:\n（ここに「・【解説対象】: 解説」形式のリスト）`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.status === 404) {
        throw new Error("APIエンドポイントが見つかりません(404)。モデル名やURLを確認してください。");
    }
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`APIエラー: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
        throw new Error("APIから有効なテキスト応答がありませんでした。");
    }

    const titleMatch = text.match(/翻訳タイトル[:：]([\s\S]*?)---/s);
    const detailedSummaryMatch = text.match(/詳細要約[:：]([\s\S]*?)---/s);
    const backgroundKnowledgeMatch = text.match(/背景知識と前提の解説[:：]([\s\S]*)/s);

    let html = '';
    const titleText = titleMatch ? titleMatch[1].trim() : '';
    const detailedSummaryText = detailedSummaryMatch ? detailedSummaryMatch[1].trim().replace(/\n/g, '<br>') : ''; // 改行を<br>に
    // 背景知識の整形
    const backgroundKnowledgeHtml = backgroundKnowledgeMatch ? backgroundKnowledgeMatch[1].trim().split(/^・/m).filter(s => s.trim() !== '').map(item => {
        const parts = item.trim().match(/^【(.*?)】[:：](.*)/s);
        if (parts && parts.length === 3) {
            return `<li style="margin-bottom: 0.8em;"><strong>【${parts[1].trim()}】:</strong><br>${parts[2].trim().replace(/\n/g, '<br>')}</li>`;
        } else {
            return `<li style="margin-bottom: 0.8em;">${item.trim().replace(/\n/g, '<br>')}</li>`; // 解析失敗時はそのまま表示（整形試行）
        }
    }).join('') : '';

    if (titleText) {
      html += `<div class='section-card'>
                  <div class='section-title'>日本語タイトル <button class='copy-button' data-clipboard-target='#copy-title-text'>コピー</button></div>
                  <div class='section-content' id='copy-title-text'>${titleText}</div>
                </div>`;
    }
    if (detailedSummaryText) {
      html += `<div class='section-card'>
                  <div class='section-title'>詳細要約 <button class='copy-button' data-clipboard-target='#copy-summary-text'>コピー</button></div>
                  <div class='section-content' id='copy-summary-text'>${detailedSummaryText}</div>
                </div>`;
    }
    if (backgroundKnowledgeHtml) {
      html += `<div class='section-card'>
                  <div class='section-title'>背景知識と前提の解説 <button class='copy-button' data-clipboard-target='#copy-background-text'>コピー</button></div>
                  <ul class='section-content' id='copy-background-text' style='list-style: none; padding-left: 0;'>${backgroundKnowledgeHtml}</ul>
                </div>`;
    }

    if (!html && text) {
        const fallbackHtml = `<div class='section-card'><div class='section-title'>処理結果</div><div class='section-content'>${text.replace(/\n/g, '<br>')}</div></div>`;
        console.warn("API応答から構造化された情報を抽出できませんでした。生のテキストを表示します。");
        return fallbackHtml; 
    }
    if (!text && !html) {
        throw new Error("APIから有効な応答がありませんでした。");
    }
    return html;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      throw new Error('APIの応答が60秒以内にありませんでした。');
    }
    throw e;
  }
}

// ストレージからキャッシュを読み込む (拡張機能起動時)
chrome.storage.local.get(null, (items) => {
  if (chrome.runtime.lastError) {
    console.error("キャッシュの読み込みに失敗:", chrome.runtime.lastError.message);
  } else {
    for (const key in items) {
      if (key.startsWith(CACHE_KEY_PREFIX)) { // 変更されたプレフィックスを使用
        apiResultsCache[key] = items[key];
        // 永続化キャッシュがあるものは、apiRequestStatusも'success'としてマークする
        // これにより、次回ポップアップ表示時に不要なAPI呼び出しを防ぐ
        apiRequestStatus[key] = 'success'; 
      }
    }
    console.log("キャッシュをストレージから読み込みました", apiResultsCache, apiRequestStatus);
    // 拡張機能起動時に現在アクティブなタブのアイコンを更新
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].id && tabs[0].url) {
        updateIconForTab(tabs[0].id, tabs[0].url);
      }
    });
  }
});

// キャッシュをストレージに保存する (変更があるたびに)
function saveCacheToStorage() {
  // apiResultsCache を chrome.storage.local に保存する。
  // キーは、各エントリのキー (CACHE_KEY_PREFIX + url) を使うか、
  // または apiResultsCache 全体を一つのオブジェクトとして保存する。
  // ここでは簡単のため、apiResultsCache全体を 'summary_cache' のようなキーで保存する例を示す。
  // ただし、個々のキーで保存する方が柔軟性は高い。
  const dataToSave = {};
  for (const key in apiResultsCache) {
    if (key.startsWith(CACHE_KEY_PREFIX)) { // プレフィックスを持つものだけ
        dataToSave[key] = apiResultsCache[key];
    }
  }
  // console.log("[Cache] 要約キャッシュの保存を試みます。", dataToSave);
  chrome.storage.local.set(dataToSave, () => {
    if (chrome.runtime.lastError) {
      console.error("[Cache] 要約キャッシュの保存に失敗:", chrome.runtime.lastError.message);
    }
  });
}

// --- クリップ機能関連 --- //
const CLIPS_STORAGE_KEY = 'saved_article_clips';
let savedClips = {}; // メモリ内キャッシュ { [url]: clipData }

// 拡張機能起動時にストレージからクリップを読み込む
function loadClipsFromStorage() {
  chrome.storage.local.get(CLIPS_STORAGE_KEY, (result) => {
    if (chrome.runtime.lastError) {
      console.error("[Clips] クリップの読み込みに失敗:", chrome.runtime.lastError.message);
      return;
    }
    if (result && result[CLIPS_STORAGE_KEY]) {
      savedClips = result[CLIPS_STORAGE_KEY];
      console.log("[Clips] クリップをストレージから正常に読み込みました。現在のクリップ数:", Object.keys(savedClips).length, savedClips);
    } else {
      console.log("[Clips] ストレージに保存されているクリップはありませんでした。savedClipsを初期化します。");
      savedClips = {}; // 明示的に初期化
    }
  });
}

// 起動時に一度実行
loadClipsFromStorage();

// クリップをストレージに保存
function saveClipsToStorage() {
  console.log("[Clips] ストレージへの保存を試みます。保存するクリップ数:", Object.keys(savedClips).length, savedClips);
  chrome.storage.local.set({ [CLIPS_STORAGE_KEY]: savedClips }, () => {
    if (chrome.runtime.lastError) {
      console.error("[Clips] クリップの保存に失敗:", chrome.runtime.lastError.message);
    } else {
      console.log("[Clips] クリップをストレージに正常に保存しました。");
    }
  });
}

// 新しいクリップを追加
async function addClip(clipData) {
  if (!clipData || !clipData.url) {
    console.error("[Clips] 追加するクリップのURLがありません。", clipData);
    return { success: false, error: "URLがありません。" };
  }
  console.log("[Clips] クリップ追加処理開始: URL=", clipData.url, "現在のクリップ数:", Object.keys(savedClips).length);
  savedClips[clipData.url] = clipData;
  console.log("[Clips] メモリ内のsavedClipsを更新しました。更新後のクリップ数:", Object.keys(savedClips).length);
  saveClipsToStorage();
  return { success: true, message: "クリップしました。", clip: savedClips[clipData.url] };
}

// 指定されたURLのクリップを削除
async function deleteClip(url) {
  console.log("[Clips] クリップ削除処理開始: URL=", url, "現在のクリップ数:", Object.keys(savedClips).length);
  if (savedClips[url]) {
    delete savedClips[url];
    console.log("[Clips] メモリ内のsavedClipsから指定URLのクリップを削除しました。更新後のクリップ数:", Object.keys(savedClips).length);
    saveClipsToStorage();
    return { success: true, message: "クリップを削除しました。" };
  } else {
    console.warn("[Clips] 削除対象のクリップが見つかりませんでした: URL=", url);
    return { success: false, error: "該当するクリップはありません。" };
  }
}

// 全てのクリップを取得
async function getAllClips() {
  console.log("[Clips] getAllClipsが呼び出されました。現在のメモリ内クリップ数:", Object.keys(savedClips).length, savedClips);
  return savedClips; 
}

// 指定されたURLがクリップ済みか確認
async function isUrlClipped(url) {
    return !!savedClips[url];
} 