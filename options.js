// options.js
document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const modelSelect = document.getElementById('modelSelect');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const settingsStatus = document.getElementById('settingsStatus');
  const clearCacheBtn = document.getElementById('clearCacheBtn');
  const cacheStatus = document.getElementById('cacheStatus');

  const SETTINGS_API_KEY = 'geminiApiKey';
  const SETTINGS_MODEL = 'geminiModel';
  const DEFAULT_MODEL = 'gemini-2.0-flash';

  // 利用可能なモデルリスト (ハードコード)
  // API経由で取得する場合は、ここでAPIを呼び出し、ドロップダウンを生成する
  const availableModels = [
    { value: "gemini-2.0-flash", text: "Gemini 2.0 Flash (高速・軽量)" },
    { value: "gemini-1.5-flash-latest", text: "Gemini 1.5 Flash (最新Flash)" },
    { value: "gemini-1.5-pro-latest", text: "Gemini 1.5 Pro (高性能)" },
    // 他のモデルを追加する場合はここに
  ];

  function populateModelSelect() {
    modelSelect.innerHTML = ''; // 一旦クリア
    availableModels.forEach(model => {
      const option = document.createElement('option');
      option.value = model.value;
      option.textContent = model.text;
      modelSelect.appendChild(option);
    });
  }
  populateModelSelect();

  // 設定を読み込んでフォームに表示
  function loadSettingsToForm() {
    chrome.storage.sync.get([SETTINGS_API_KEY, SETTINGS_MODEL], (settings) => {
      if (chrome.runtime.lastError) {
        settingsStatus.textContent = '設定の読み込みに失敗しました。';
        settingsStatus.className = 'status-message error';
        console.error("設定読み込みエラー:", chrome.runtime.lastError.message);
        return;
      }
      if (settings[SETTINGS_API_KEY]) {
        apiKeyInput.value = settings[SETTINGS_API_KEY];
      }
      if (settings[SETTINGS_MODEL]) {
        modelSelect.value = settings[SETTINGS_MODEL];
      } else {
        modelSelect.value = DEFAULT_MODEL;
      }
    });
  }
  loadSettingsToForm();

  // 設定保存ボタンの処理
  saveSettingsBtn.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    const selectedModel = modelSelect.value;

    if (!apiKey) {
      settingsStatus.textContent = 'APIキーを入力してください。';
      settingsStatus.className = 'status-message error';
      return;
    }

    chrome.storage.sync.set({
      [SETTINGS_API_KEY]: apiKey,
      [SETTINGS_MODEL]: selectedModel
    }, () => {
      if (chrome.runtime.lastError) {
        settingsStatus.textContent = '設定の保存に失敗しました。';
        settingsStatus.className = 'status-message error';
        console.error("設定保存エラー:", chrome.runtime.lastError.message);
      } else {
        settingsStatus.textContent = '設定を保存しました。';
        settingsStatus.className = 'status-message success';
        setTimeout(() => { settingsStatus.textContent = ''; settingsStatus.className = 'status-message'; }, 3000);
      }
    });
  });

  // キャッシュクリアボタンの処理
  clearCacheBtn.addEventListener('click', () => {
    if (confirm("全ての要約キャッシュとクリップデータをクリアします。よろしいですか？")) {
      chrome.runtime.sendMessage({ action: "clearAllCache" }, (response) => {
        if (chrome.runtime.lastError) {
          cacheStatus.textContent = 'キャッシュクリア中にエラーが発生しました。';
          cacheStatus.className = 'status-message error';
          console.error("キャッシュクリアメッセージエラー:", chrome.runtime.lastError.message);
          return;
        }
        if (response && response.success) {
          cacheStatus.textContent = response.message || 'キャッシュをクリアしました。';
          cacheStatus.className = 'status-message success';
        } else {
          cacheStatus.textContent = response.error || 'キャッシュのクリアに失敗しました。';
          cacheStatus.className = 'status-message error';
        }
        setTimeout(() => { cacheStatus.textContent = ''; cacheStatus.className = 'status-message'; }, 4000);
      });
    }
  });
}); 