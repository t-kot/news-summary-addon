// clips.js
document.addEventListener('DOMContentLoaded', () => {
  const clipsTableBody = document.getElementById('clipsTable').querySelector('tbody');
  let allClipsData = {}; // 取得したクリップデータを保持

  function displayClips(clips) {
    clipsTableBody.innerHTML = ''; // テーブルをクリア
    if (Object.keys(clips).length === 0) {
      clipsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">クリップされた記事はありません。</td></tr>';
      return;
    }

    // タイムスタンプの降順（新しいものが上）にソート
    const sortedClips = Object.values(clips).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    sortedClips.forEach(clip => {
      const row = clipsTableBody.insertRow();
      const titleCell = row.insertCell();
      const urlCell = row.insertCell();
      const timestampCell = row.insertCell();
      const actionsCell = row.insertCell();

      titleCell.textContent = clip.title;
      const urlLink = document.createElement('a');
      urlLink.href = clip.url;
      urlLink.textContent = clip.url;
      urlLink.target = '_blank';
      urlLink.className = 'clip-url';
      urlCell.appendChild(urlLink);
      timestampCell.textContent = new Date(clip.timestamp).toLocaleString('ja-JP');

      // アクションボタン
      const viewButton = document.createElement('button');
      viewButton.textContent = '詳細表示';
      viewButton.className = 'action-button view-button';
      viewButton.onclick = () => showClipDetailModal(clip);
      actionsCell.appendChild(viewButton);

      const deleteButton = document.createElement('button');
      deleteButton.textContent = '削除';
      deleteButton.className = 'action-button delete-button';
      deleteButton.onclick = () => {
        if (confirm(`「${clip.title}」を削除してもよろしいですか？`)) {
          chrome.runtime.sendMessage({ action: "deleteClip", data: { url: clip.url } }, (response) => {
            if (response && response.success) {
              alert(response.message);
              loadAndDisplayClips(); // リストを再読み込み
            } else {
              alert("削除に失敗しました: " + (response?.error || '不明なエラー'));
            }
          });
        }
      };
      actionsCell.appendChild(deleteButton);
    });
  }

  function loadAndDisplayClips() {
    chrome.runtime.sendMessage({ action: "getAllClips" }, (clips) => {
      if (clips) {
        allClipsData = clips; // データを保持
        displayClips(clips);
      } else {
        clipsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">クリップの読み込みに失敗しました。</td></tr>';
      }
    });
  }

  // モーダル関連のDOM要素（clips.html側で用意することを想定）
  function setupModal() {
    const modal = document.createElement('div');
    modal.id = 'clipDetailModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close-button">&times;</span>
        <div class="modal-body" id="modalBodyContent">
          <h2>クリップ詳細</h2>
          <h3 id="modalClipTitle"></h3>
          <p><strong>URL:</strong> <a id="modalClipUrl" href="#" target="_blank"></a></p>
          <p><strong>クリップ日時:</strong> <span id="modalClipTimestamp"></span></p>
          <hr>
          <h4>保存された要約・解説:</h4>
          <div id="modalClipSummaryHtml"></div>
          <hr>
          <h4>保存された記事本文 (最初の500文字):</h4>
          <pre id="modalClipPageBodyText" style="white-space: pre-wrap; word-break: break-all; max-height: 200px; overflow-y: auto; background: #eee; padding: 10px; border-radius: 4px;"></pre>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const closeButton = modal.querySelector('.close-button');
    closeButton.onclick = () => modal.style.display = 'none';
    window.onclick = (event) => {
      if (event.target == modal) {
        modal.style.display = 'none';
      }
    };
    return modal;
  }
  const clipDetailModal = setupModal(); // モーダルをページに追加

  function showClipDetailModal(clip) {
    document.getElementById('modalClipTitle').textContent = clip.title;
    const modalUrlLink = document.getElementById('modalClipUrl');
    modalUrlLink.href = clip.url;
    modalUrlLink.textContent = clip.url;
    document.getElementById('modalClipTimestamp').textContent = new Date(clip.timestamp).toLocaleString('ja-JP');
    document.getElementById('modalClipSummaryHtml').innerHTML = clip.summaryHtml; // HTMLとして挿入
    document.getElementById('modalClipPageBodyText').textContent = clip.pageBodyText ? clip.pageBodyText.substring(0, 500) + (clip.pageBodyText.length > 500 ? '...' : '') : '本文なし';
    
    clipDetailModal.style.display = 'block';
  }

  // CSVダウンロードボタンの処理
  const downloadCsvButton = document.getElementById('downloadCsvBtn');
  if (downloadCsvButton) {
    downloadCsvButton.addEventListener('click', () => {
      if (Object.keys(allClipsData).length === 0) {
        alert("ダウンロードするクリップがありません。");
        return;
      }
      generateAndDownloadCsv(allClipsData);
    });
  }

  function generateAndDownloadCsv(clips) {
    let csvContent = "data:text/csv;charset=utf-8,";
    const headers = ["タイトル", "URL", "クリップ日時", "要約・解説（テキスト）", "記事本文"]; // ヘッダー名変更
    csvContent += headers.map(h => `"${escapeCsvField(h)}"`).join(",") + "\r\n";

    const sortedClips = Object.values(clips).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    sortedClips.forEach(clip => {
      // summaryHtmlからHTMLタグを除去してプレーンテキストにする
      let summaryText = '';
      if (clip.summaryHtml) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = clip.summaryHtml;
        // 箇条書きの「・」や改行を保持しつつテキスト化する工夫
        // (liタグを改行と「・ 」で置き換えるなど、より丁寧な処理も可能だが、今回はinnerTextを基本とする)
        // 簡単なテキスト化として、ブロック要素の後に改行をイメージ
        Array.from(tempDiv.querySelectorAll('div.section-card')).forEach(card => {
            const titleEl = card.querySelector('.section-title');
            const contentEl = card.querySelector('.section-content');
            if(titleEl) summaryText += titleEl.innerText.replace(/コピー$/, '').trim() + ":\n"; // ボタンテキスト除去
            if(contentEl) {
                if(contentEl.tagName === 'UL'){
                    Array.from(contentEl.querySelectorAll('li')).forEach(li => {
                        summaryText += "  ・" + li.innerText + "\n";
                    });
                } else {
                    summaryText += contentEl.innerText + "\n";
                }
            }
            summaryText += "\n"; // セクション間の区切り
        });
        summaryText = summaryText.trim();
        if (!summaryText) { // もし上記でうまく取れなければ、単純なinnerText
            summaryText = tempDiv.innerText || '';
        }
      }

      const row = [
        clip.title,
        clip.url,
        new Date(clip.timestamp).toLocaleString('ja-JP'),
        summaryText, // タグ除去したテキスト
        clip.pageBodyText
      ];
      csvContent += row.map(field => `"${escapeCsvField(String(field))}"`).join(",") + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[-T:]/g, '');
    link.setAttribute("download", `clipped_articles_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function escapeCsvField(field) {
    if (field === undefined || field === null) return '';
    let strField = String(field);
    // " を "" にエスケープし、全体をダブルクォートで囲むことで、カンマや改行を含むフィールドに対応
    return strField.replace(/"/g, '""');
  }

  // 初期表示
  loadAndDisplayClips();
}); 