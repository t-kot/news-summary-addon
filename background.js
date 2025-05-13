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
    // APIキーが設定されているか確認
    if (!currentApiKey) { // currentApiKey はグローバル変数または適切にスコープされていると仮定
      console.error("[API] Gemini APIキーが設定されていません。オプションページで設定してください。");
      sendResponse({ status: 'error', error: "APIキーが未設定です。拡張機能のオプションページで設定してください。" });
      // アイコンをエラー状態にするなどの処理も必要に応じて追加
      const { tabId, pageUrl } = request.data;
      if (tabId && pageUrl) {
        apiRequestStatus[CACHE_KEY_PREFIX + pageUrl] = 'error'; // pageUrlではなく、CACHE_KEY_PREFIX + pageUrl を使用
        updateIconForTab(tabId, pageUrl);
      }
      return true; // trueを返してレスポンスが非同期であることを示す
    }

    const { pageUrl, pageTitle, pageText, forceReload, tabId, siteType, videoUrl } = request.data; // siteType, videoUrl を追加
    const cacheKey = CACHE_KEY_PREFIX + pageUrl;


    if (forceReload) {
      apiRequestStatus[cacheKey] = 'loading';
      updateIconForTab(tabId, pageUrl);
    } else {
      if (apiResultsCache[cacheKey]) {
        sendResponse({ status: 'success', data: apiResultsCache[cacheKey] });
        apiRequestStatus[cacheKey] = 'success';
        updateIconForTab(tabId, pageUrl);
        return true;
      }
      if (apiRequestStatus[cacheKey] === 'loading') {
        sendResponse({ status: 'loading' });
        return true;
      }
    }

        apiRequestStatus[cacheKey] = 'loading';
        updateIconForTab(tabId, pageUrl); 
    // 初回リクエスト（キャッシュなし、リロードフラグなし）の場合のみ、ここでローディングを返す
    if (!forceReload && !apiResultsCache[cacheKey]) {
        sendResponse({ status: 'loading' });
    }


    fetchSummaryFromGemini(pageUrl, pageTitle, pageText, cacheKey, siteType, videoUrl) // siteType, videoUrl を追加
      .then(html => {
        apiResultsCache[cacheKey] = html;
        apiRequestStatus[cacheKey] = 'success';
        saveCacheToStorage();
        updateIconForTab(tabId, pageUrl);
        chrome.runtime.sendMessage({ action: "summaryUpdated", status: 'success', data: html, forUrl: pageUrl, tabIdForIcon: tabId }, response => {
          if (chrome.runtime.lastError) { /* console.log("[BG] summaryUpdated (success) 応答なし: ポップアップ非表示の可能性") */} 
        });
        // forceReloadの場合、最初のsendResponse({status: 'loading'})が呼ばれていないので、ここで成功を返す必要があるか検討
        // しかし、summaryUpdatedで通知しているので、ポップアップ側でそれをハンドルするなら不要かもしれない
        // 現状のロジックでは、forceReload=trueでキャッシュがない場合、sendResponseが呼ばれずにここまで到達する
        // そのため、forceReload=true の場合はここで明示的にレスポンスを返す必要がある
        if (forceReload) {
            // ただし、既に上で sendResponse({ status: 'loading' }) が呼ばれている可能性があるため、
            // 重複呼び出しを避ける。summaryUpdated で状態は通知されるので、ここでは返さない。
            // sendResponse({ status: 'success', data: html }); 
        }
      })
      .catch(error => {
        apiRequestStatus[cacheKey] = 'error';
        updateIconForTab(tabId, pageUrl);
        chrome.runtime.sendMessage({ action: "summaryUpdated", status: 'error', error: error.message, forUrl: pageUrl, tabIdForIcon: tabId }, response => {
          if (chrome.runtime.lastError) { /* console.log("[BG] summaryUpdated (error) 応答なし: ポップアップ非表示の可能性") */ }
        });
        // エラー時も forceReload の場合と同様に、sendResponse が呼ばれていない可能性がある
        if (forceReload) {
            // sendResponse({ status: 'error', error: error.message });
        }
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

async function fetchSummaryFromGemini(pageUrl, pageTitle, pageText, cacheKey, siteType, videoUrl) {
  // APIキーとモデル名をグローバル変数から使用
  if (!currentApiKey) {
    // このチェックは呼び出し元の onMessage リスナーでも行われているが、念のためここでも行う
    console.error("[API] fetchSummaryFromGemini: APIキーが設定されていません。");
    throw new Error("APIキーが設定されていません。拡張機能のオプションページで設定してください。");
  }
  const geminiApiKey = currentApiKey;

  let prompt;
  console.log(`[Gemini Request] SiteType: ${siteType}, PageURL: ${pageUrl}, VideoURL: ${videoUrl}, Model: ${currentModel}`);

  switch (siteType) {
    case 'youtube':
      if (videoUrl) {
        prompt = `この動画を日本語で要約してください。動画内の重要な情報やニュアンスができるだけ欠落しないように、詳細な要約をお願いします。内容を正確に伝えるためであれば、要約が長くなっても構いません。動画の主要なトピック、議論されているポイント、具体的な例、そして結論を網羅的に含めてください。

さらに、要約の各部分や言及箇所について、それが動画のどの時間（何分何秒）で述べられているかを必ず示してください。タイムスタンプは、例えば「〇〇という発言がありました。（2:30）」のように、括弧（）で囲んでテキストとして付記してください。URL形式のリンクは含めないでください。

動画URL: ${videoUrl}`;
        if (pageTitle) {
          prompt += `\n動画タイトル: ${pageTitle}`;
        }
      } else {
        console.error("YouTube siteType specified but videoUrl is missing.");
        return Promise.reject(new Error("YouTube動画のURLが指定されていません。"));
      }
      break;
    case 'general':
    default:
      if (pageText) {
        prompt = `次の情報はウェブページから取得したものです。\n\n【title】\n${pageTitle}\n\n【本文テキスト（ノイズ含む）】\n${pageText}\n\n指示:\n1. titleを日本語に翻訳してください。(もし元が日本語の場合はそのままで良い)\n2. 本文テキストの内容を、記事全体の流れ（導入、主要な出来事や議論、結論など）が明確にわかるように、詳細な日本語で要約してください。文字数制限は特に設けませんが、冗長にならないよう留意してください。\n3. 本文テキストで言及されている主要なトピックや出来事について、記事中では直接的に説明されていない可能性のある背景知識、関連する事実、または理解を助ける前提条件を、3～5個程度選び出し、それぞれについて100～150字程度の日本語で解説してください。各項目は「・【解説対象のトピックや出来事】: （ここに関連知識や背景の解説）」の形式で記述してください。\n\n出力は必ず以下の形式で、各セクションの間に「---」を入れてください：\n翻訳タイトル:（ここに翻訳タイトル）\n---\n詳細要約:\n（ここに記事全体の流れがわかる詳細な要約）\n---\n背景知識と前提の解説:\n（ここに「・【解説対象】: 解説」形式のリスト）`;
      } else {
        console.error("General siteType specified but pageText is missing.");
        return Promise.reject(new Error("要約対象の本文が指定されていません。"));
      }
      break;
  }

  if (!prompt) {
    console.error("Prompt could not be generated.", { siteType, videoUrl, pageTextProvided: !!pageText });
    return Promise.reject(new Error("要約のためのプロンプトを生成できませんでした。"));
  }

  console.log("Sending prompt to Gemini:", prompt);

  // Gemini APIのセットアップ (currentApiKey と currentModel はグローバル変数として利用可能である前提)
  // genAIインスタンスの生成は、ファイルスコープで行われているか、都度生成するかによる。
  // ここでは都度生成する形に変更（GoogleGenerativeAIクラスがグローバルに存在すると仮定）
  // ただし、通常は一度インスタンス化して使いまわす方が効率的。
  // 既存コードで const genAI = new GoogleGenerativeAI(geminiApiKey); のような記述がないため、
  // fetch API を直接使う既存の形を維持し、モデル名のみを currentModel から取得する。

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒

  try {
    // モデル名を currentModel から取得
    console.log(`[API] Using model for this request: ${currentModel}`); 
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
        // generationConfig や safetySettings も必要に応じて追加できます
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.status === 404) {
        throw new Error(`APIエンドポイントが見つかりません(404)。モデル名「${currentModel}」やURLを確認してください。`);
    }
    if (!response.ok) {
        const errorBodyText = await response.text(); // エラーレスポンスの本文をまず取得
        let errorDetail = errorBodyText;
        try {
            const errorData = JSON.parse(errorBodyText); // JSONとしてパース試行
            errorDetail = errorData.error?.message || errorBodyText;
        } catch (e) {
            // パース失敗時はテキストのまま
        }
        throw new Error(`APIエラー: ${response.status} ${response.statusText}. ${errorDetail}`);
    }

    const data = await response.json();
    // Gemini API (v1beta) のgenerateContentのレスポンス構造に合わせて修正
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        console.warn("APIから有効なテキスト応答がありませんでした。レスポンスデータ:", JSON.stringify(data, null, 2));
        throw new Error("APIから期待される形式のテキスト応答がありませんでした。");
    }

    let summaryTitlePrefix = siteType === 'youtube' ? "動画" : "記事";
    const displayTitle = pageTitle || (siteType === 'youtube' && videoUrl ? videoUrl : pageUrl);
    
    let html = '';
    if (siteType === 'youtube') {
        // YouTube動画の場合、Geminiからのテキストを整形せずに、改行を<br>に置換するのみ
        console.log("[DEBUG] Raw text from Gemini for YouTube video (no link processing):", text);
        html = `<div class='section-card'>
                  <div class='section-title'>${summaryTitlePrefix}の要約 (${displayTitle}) <button class='copy-button' data-clipboard-target='#copy-summary-text'>コピー</button></div>
                  <div class='section-content' id='copy-summary-text'>${text.replace(/\n/g, '<br>')}</div>
                </div>`;
    } else {
        // 一般記事の場合は既存のHTML整形ロジックを使用
    const titleMatch = text.match(/翻訳タイトル[:：]([\s\S]*?)---/s);
    const detailedSummaryMatch = text.match(/詳細要約[:：]([\s\S]*?)---/s);
    const backgroundKnowledgeMatch = text.match(/背景知識と前提の解説[:：]([\s\S]*)/s);

    const titleText = titleMatch ? titleMatch[1].trim() : '';
        const detailedSummaryText = detailedSummaryMatch ? detailedSummaryMatch[1].trim().replace(/\n/g, '<br>') : '';
    const backgroundKnowledgeHtml = backgroundKnowledgeMatch ? backgroundKnowledgeMatch[1].trim().split(/^・/m).filter(s => s.trim() !== '').map(item => {
        const parts = item.trim().match(/^【(.*?)】[:：](.*)/s);
        if (parts && parts.length === 3) {
            return `<li style="margin-bottom: 0.8em;"><strong>【${parts[1].trim()}】:</strong><br>${parts[2].trim().replace(/\n/g, '<br>')}</li>`;
        } else {
                return `<li style="margin-bottom: 0.8em;">${item.trim().replace(/\n/g, '<br>')}</li>`;
        }
    }).join('') : '';

    if (titleText) {
      html += `<div class='section-card'>
                      <div class='section-title'>日本語タイトル <button class='copy-button' data-clipboard-target='#copy-title-text-${Date.now()}'>コピー</button></div>
                      <div class='section-content' id='copy-title-text-${Date.now()}'>${titleText}</div>
                </div>`;
    }
    if (detailedSummaryText) {
      html += `<div class='section-card'>
                      <div class='section-title'>詳細要約 <button class='copy-button' data-clipboard-target='#copy-summary-text-${Date.now()}'>コピー</button></div>
                      <div class='section-content' id='copy-summary-text-${Date.now()}'>${detailedSummaryText}</div>
                </div>`;
    }
    if (backgroundKnowledgeHtml) {
      html += `<div class='section-card'>
                      <div class='section-title'>背景知識と前提の解説 <button class='copy-button' data-clipboard-target='#copy-background-text-${Date.now()}'>コピー</button></div>
                      <ul class='section-content' id='copy-background-text-${Date.now()}' style='list-style: none; padding-left: 0;'>${backgroundKnowledgeHtml}</ul>
                </div>`;
    }
        // 一般記事で、もし上記の構造化された情報が取れなかった場合のフォールバック
    if (!html && text) {
            html = `<div class='section-card'><div class='section-title'>${summaryTitlePrefix}の要約 (${displayTitle}) <button class='copy-button' data-clipboard-target='#copy-summary-text'>コピー</button></div><div class='section-content' id='copy-summary-text'>${text.replace(/\n/g, '<br>')}</div></div>`;
            console.warn("一般記事のAPI応答から構造化された情報を抽出できませんでした。生のテキストを表示します。");
        }
    }

    if (!html) { // YouTubeの場合も一般記事の場合も、最終的にhtmlが空ならエラー
        throw new Error("APIからの応答をHTMLに整形できませんでした。");
    }
    return html;

  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      throw new Error('APIの応答が60秒以内にありませんでした。');
    }
    // エラーメッセージをよりユーザーフレンドリーにする
    let userFriendlyError = "Gemini APIとの通信中に予期せぬエラーが発生しました。";
    if (e.message) {
        if (e.message.toLowerCase().includes("api key") || e.message.toLowerCase().includes("api_key")) {
            userFriendlyError = "APIキーが無効か、正しく設定されていません。拡張機能のオプションページで確認してください。";
        } else if (e.message.toLowerCase().includes("quota")) {
            userFriendlyError = "APIの利用上限に達したか、一時的な制限の可能性があります。時間をおいて再度お試しください。";
        } else if (e.message.includes("APIエンドポイントが見つかりません") || e.message.includes("Failed to fetch")) {
            userFriendlyError = `APIへの接続に失敗しました。モデル名「${currentModel}」が正しいか、ネットワーク接続を確認してください。`;
        } else {
            userFriendlyError = e.message; // その他のエラーはそのまま表示
        }
    }
    console.error("fetchSummaryFromGemini Error:", e, "User-friendly message:", userFriendlyError);
    throw new Error(userFriendlyError);
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