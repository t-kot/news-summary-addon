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
    let csvContent = "";
    const headers = ["title", "url", "summary", "explanation", "clipped_at", "full_content"];
    csvContent += headers.map(h => escapeAndQuoteCsvField(h)).join(",") + "\r\n";

    const clipsArray = Object.values(clips);
    const sortedClips = clipsArray.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    for (const clip of sortedClips) {
      let summaryText = '';
      let explanationText = '';
      
      if (clip.summaryHtml) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = clip.summaryHtml;
        
        const summarySection = tempDiv.querySelector('.section-card:nth-child(2) .section-content');
        if (summarySection) {
          summaryText = summarySection.innerText.trim();
        }
        
        const explanationSection = tempDiv.querySelector('.section-card:nth-child(3) .section-content');
        if (explanationSection) {
          explanationText = explanationSection.innerText.trim();
        }

        if (!summaryText || !explanationText) {
          const sections = tempDiv.querySelectorAll('.section-card');
          sections.forEach(section => {
            const titleEl = section.querySelector('.section-title');
            const contentEl = section.querySelector('.section-content');
            if (titleEl && contentEl) {
              const title = titleEl.innerText.replace(/コピー$/, '').trim();
              if (title.includes('要約') && !summaryText) {
                summaryText = contentEl.innerText.trim();
              } else if (title.includes('解説') && !explanationText) {
                explanationText = contentEl.innerText.trim();
              }
            }
          });
        }
      }

      const row = [
        clip.title,
        clip.url,
        summaryText,
        explanationText,
        new Date(clip.timestamp).toLocaleString('ja-JP'),
        clip.pageBodyText
      ];

      csvContent += row.map(field => escapeAndQuoteCsvField(field)).join(",") + "\r\n";
    }

    // Blobを使用してCSVファイルを生成
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // ダウンロードリンクを作成してクリック
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[-T:]/g, '');
    link.setAttribute("download", `clipped_articles_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 生成したURLを解放
    URL.revokeObjectURL(url);
  }

  // RFC 4180準拠のCSVフィールドエスケープ・クォート関数
  function escapeAndQuoteCsvField(field) {
    if (field === undefined || field === null) return '';
    const strField = String(field);
    // ダブルクォートを2重にエスケープ
    const escapedField = strField.replace(/"/g, '""');
    // カンマ、ダブルクォート、改行が含まれる場合は必ずダブルクォートで囲む
    if (/[",\n\r]/.test(strField)) {
      return `"${escapedField}"`;
    } else {
      return escapedField;
    }
  }

  // 初期表示
  loadAndDisplayClips();
}); 