marked.setOptions({ breaks: true, gfm: true, headerIds: false, mangle: false });

// ========== Safe HTML rendering ==========
function safeMarkdown(text) {
    return DOMPurify.sanitize(marked.parse(text));
}

// ========== Auth State ==========
var authMode = 'login'; // 'login' or 'register'
var userId = localStorage.getItem('userId');
var currentUsername = localStorage.getItem('username') || '';

function checkAuth() {
    if (!userId) {
        document.getElementById('authModal').style.display = 'flex';
    }
}

function toggleAuthMode() {
    if (authMode === 'login') {
        authMode = 'register';
        document.getElementById('authModalTitle').textContent = 'Kayit Ol';
        document.getElementById('authSubmitBtn').textContent = 'Kayit Ol';
        document.getElementById('authSwitchText').textContent = 'Zaten hesabin var mi?';
        document.getElementById('authSwitchBtn').textContent = 'Giris Yap';
    } else {
        authMode = 'login';
        document.getElementById('authModalTitle').textContent = 'Giris Yap';
        document.getElementById('authSubmitBtn').textContent = 'Giris Yap';
        document.getElementById('authSwitchText').textContent = 'Hesabin yok mu?';
        document.getElementById('authSwitchBtn').textContent = 'Kayit Ol';
    }
    document.getElementById('authError').style.display = 'none';
}

async function submitAuth() {
    var username = document.getElementById('authUsername').value.trim();
    var password = document.getElementById('authPassword').value.trim();
    var errorEl = document.getElementById('authError');

    if (!username || !password) {
        errorEl.textContent = 'Kullanici adi ve sifre gerekli';
        errorEl.style.display = 'block';
        return;
    }

    var endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    try {
        var res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username, password: password })
        });
        var data = await res.json();
        if (!res.ok) {
            errorEl.textContent = data.error || 'Bir hata olustu';
            errorEl.style.display = 'block';
            return;
        }
        // Success
        userId = data.user_id;
        currentUsername = data.username;
        localStorage.setItem('userId', userId);
        localStorage.setItem('username', currentUsername);
        document.getElementById('authModal').style.display = 'none';
        document.getElementById('authUsername').value = '';
        document.getElementById('authPassword').value = '';
        errorEl.style.display = 'none';
        showToast(authMode === 'login' ? 'Giris basarili!' : 'Kayit basarili!');
        updateProfileUI();
        loadSessions();
    } catch (e) {
        errorEl.textContent = 'Baglanti hatasi. Lutfen tekrar deneyin.';
        errorEl.style.display = 'block';
    }
}

// Handle Enter key in auth inputs
document.addEventListener('DOMContentLoaded', function() {
    var authPasswordEl = document.getElementById('authPassword');
    var authUsernameEl = document.getElementById('authUsername');
    if (authPasswordEl) {
        authPasswordEl.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') submitAuth();
        });
    }
    if (authUsernameEl) {
        authUsernameEl.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') submitAuth();
        });
    }
});

// ========== User ID ==========
var sessionId = null;
var currentViewBookId = null; // PDF icin

var messagesEl = document.getElementById('chatMessages');
var inputEl = document.getElementById('messageInput');
var sendBtn = document.getElementById('sendBtn');
var typingEl = document.getElementById('typing');
var welcomeEl = document.getElementById('welcome');
var scrollBtn = document.getElementById('scrollBottomBtn');
var sessionListEl = document.getElementById('sessionList');
var sidebarEl = document.getElementById('sidebar');
var overlayEl = document.getElementById('sidebarOverlay');
var bookTreeEl = document.getElementById('bookTree');

// ========== Silme Onay Diyalogu ==========
function confirmDelete(message, onConfirm) {
    if (confirm(message)) onConfirm();
}

// ========== Toast ==========
function showToast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function() { t.classList.remove('show'); }, 2500);
}

// ========== Tema ==========
function toggleTheme() {
    var c = document.documentElement.getAttribute('data-theme');
    var n = c === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', n);
    localStorage.setItem('theme', n);
    document.getElementById('themeIcon').textContent = n === 'light' ? '\uD83C\uDF19' : '\u2600\uFE0F';
}
(function() {
    var theme = document.documentElement.getAttribute('data-theme');
    if (theme === 'light') document.getElementById('themeIcon').textContent = '\uD83C\uDF19';
})();

// ========== Sidebar ==========
function toggleSidebar() { sidebarEl.classList.toggle('open'); overlayEl.classList.toggle('active'); }

function switchSidebarTab(tab, btn) {
    document.querySelectorAll('.sidebar-tab').forEach(function(t) { t.classList.remove('active'); });
    btn.classList.add('active');
    document.getElementById('panelChats').style.display = tab === 'chats' ? '' : 'none';
    document.getElementById('panelBooks').style.display = tab === 'books' ? '' : 'none';
    document.getElementById('panelIngredients').style.display = tab === 'ingredients' ? '' : 'none';
    if (tab === 'books') { loadBookTree(); loadShoppingLists(); }
    if (tab === 'ingredients') {
        var ingInput = document.getElementById('sidebarIngredientInput');
        if (ingInput) ingInput.focus();
    }
}

// ========== Sohbet Gecmisi ==========
function createSessionItem(s) {
    var div = document.createElement('div');
    div.className = 'session-item';
    div.setAttribute('data-session-id', s.session_id);
    if (s.session_id === sessionId) div.classList.add('active');
    var titleSpan = document.createElement('span');
    titleSpan.className = 'session-title';
    titleSpan.textContent = s.title;
    titleSpan.onclick = function() { loadSession(s.session_id); };
    div.appendChild(titleSpan);
    var menuBtn = document.createElement('button');
    menuBtn.className = 'session-menu-btn';
    menuBtn.textContent = '\u2026';
    menuBtn.onclick = function(e) { showSessionMenu(e, s.session_id, s.title); };
    div.appendChild(menuBtn);
    return div;
}

async function loadSessions() {
    try {
        // Load folders
        var foldersRes = await fetch('/api/chat-folders?user_id=' + (userId || ''));
        var folders = await foldersRes.json();

        // Load sessions
        var res = await fetch('/api/sessions?user_id=' + (userId || ''));
        var sessions = await res.json();

        sessionListEl.innerHTML = '';

        // Group sessions by folder
        var foldered = {};
        var unfiled = [];
        folders.forEach(function(f) { foldered[f.id] = { folder: f, sessions: [] }; });
        sessions.forEach(function(s) {
            if (s.folder_id && foldered[s.folder_id]) {
                foldered[s.folder_id].sessions.push(s);
            } else {
                unfiled.push(s);
            }
        });

        // Render folders
        folders.forEach(function(f) {
            var group = foldered[f.id];
            var folderEl = document.createElement('div');
            folderEl.className = 'chat-folder-group';

            var header = document.createElement('div');
            header.className = 'chat-folder-header';
            header.innerHTML = '<span class="chat-folder-arrow">\u25B6</span> \uD83D\uDCC1 ' + DOMPurify.sanitize(f.name) + ' <span class="chat-folder-count">(' + group.sessions.length + ')</span>';
            header.onclick = function() { folderEl.classList.toggle('expanded'); };

            var delBtn = document.createElement('button');
            delBtn.className = 'chat-folder-delete';
            delBtn.textContent = '\u2715';
            delBtn.onclick = function(e) { e.stopPropagation(); confirmDelete('Bu klasoru silmek istediginize emin misiniz? Sohbetler silinmez, klasorsuz olur.', function() { deleteChatFolder(f.id); }); };
            header.appendChild(delBtn);

            folderEl.appendChild(header);

            var list = document.createElement('div');
            list.className = 'chat-folder-sessions';
            group.sessions.forEach(function(s) { list.appendChild(createSessionItem(s)); });
            folderEl.appendChild(list);

            sessionListEl.appendChild(folderEl);
        });

        // Render unfiled sessions
        if (folders.length > 0 && unfiled.length > 0) {
            var label = document.createElement('div');
            label.className = 'unfiled-label';
            label.textContent = 'Diger';
            sessionListEl.appendChild(label);
        }
        unfiled.forEach(function(s) { sessionListEl.appendChild(createSessionItem(s)); });
    } catch(e) {}
}

// ========== Session Context Menu ==========
function showSessionMenu(e, sid, titleText) {
    e.stopPropagation();
    closeSessionMenu();

    var menu = document.createElement('div');
    menu.className = 'session-context-menu';
    menu.id = 'activeSessionMenu';

    // Rename option
    var renameBtn = document.createElement('button');
    renameBtn.innerHTML = '\u270F\uFE0F Yeniden Adlandir';
    renameBtn.onclick = function(ev) { ev.stopPropagation(); closeSessionMenu(); startRenameSession(sid); };
    menu.appendChild(renameBtn);

    // Move to folder option
    var moveBtn = document.createElement('button');
    moveBtn.innerHTML = '\uD83D\uDCC1 Klasore Tasi';
    moveBtn.onclick = function(ev) { ev.stopPropagation(); closeSessionMenu(); showMoveToFolderModal(sid); };
    menu.appendChild(moveBtn);

    // Delete option
    var deleteBtn = document.createElement('button');
    deleteBtn.className = 'menu-delete-option';
    deleteBtn.innerHTML = '\uD83D\uDDD1 Sohbeti Sil';
    deleteBtn.onclick = function(ev) { ev.stopPropagation(); closeSessionMenu(); confirmDelete('Bu sohbeti silmek istediginize emin misiniz?', function() { deleteSession(sid); }); };
    menu.appendChild(deleteBtn);

    // Position near the button
    e.target.closest('.session-item').appendChild(menu);
}

function closeSessionMenu() {
    var existing = document.getElementById('activeSessionMenu');
    if (existing) existing.remove();
}

// Close menu when clicking outside
document.addEventListener('click', function() { closeSessionMenu(); });

// ========== Chat Folders ==========
function promptNewChatFolder() {
    var name = prompt('Yeni klasor adi:');
    if (!name || !name.trim()) return;
    fetch('/api/chat-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, name: name.trim() })
    }).then(function() { loadSessions(); showToast('Klasor olusturuldu!'); });
}

async function deleteChatFolder(folderId) {
    try {
        await fetch('/api/chat-folders/' + folderId, { method: 'DELETE' });
        showToast('Klasor silindi');
        loadSessions();
    } catch(e) { showToast('Silme hatasi'); }
}

async function showMoveToFolderModal(sid) {
    // Fetch folders
    var foldersRes = await fetch('/api/chat-folders?user_id=' + (userId || ''));
    var folders = await foldersRes.json();

    var overlay = document.createElement('div');
    overlay.className = 'move-folder-modal';
    overlay.id = 'moveFolderModal';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    var box = document.createElement('div');
    box.className = 'move-folder-box';

    var header = document.createElement('div');
    header.className = 'move-folder-header';
    header.innerHTML = '<h3>Klasore Tasi</h3>';
    var closeBtn = document.createElement('button');
    closeBtn.className = 'move-folder-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = function() { overlay.remove(); };
    header.appendChild(closeBtn);
    box.appendChild(header);

    var list = document.createElement('div');
    list.className = 'move-folder-list';

    if (folders.length === 0) {
        var emptyMsg = document.createElement('div');
        emptyMsg.style.cssText = 'padding:16px;text-align:center;color:var(--text-secondary);font-size:13px;';
        emptyMsg.textContent = 'Henuz klasor yok. Once bir klasor olusturun.';
        list.appendChild(emptyMsg);
    } else {
        folders.forEach(function(f) {
            var btn = document.createElement('button');
            btn.className = 'move-folder-option';
            btn.textContent = '\uD83D\uDCC1 ' + f.name;
            btn.onclick = function() {
                moveSessionToFolder(sid, f.id);
                overlay.remove();
            };
            list.appendChild(btn);
        });

        // Remove from folder option
        var removeBtn = document.createElement('button');
        removeBtn.className = 'move-folder-option remove-option';
        removeBtn.textContent = '\u2716 Klasorden Cikar';
        removeBtn.onclick = function() {
            moveSessionToFolder(sid, null);
            overlay.remove();
        };
        list.appendChild(removeBtn);
    }

    box.appendChild(list);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

async function moveSessionToFolder(sid, folderId) {
    try {
        await fetch('/api/sessions/' + sid + '/move', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder_id: folderId, user_id: userId })
        });
        showToast(folderId ? 'Sohbet klasore tasildi' : 'Sohbet klasorden cikarildi');
        loadSessions();
    } catch(e) { showToast('Tasima hatasi'); }
}

async function loadSession(sid) {
    sessionId = sid;
    closeRecipeViewer();
    closeProfilePanel();
    closeTrashPanel();
    document.getElementById('chatContainer').style.display = '';
    messagesEl.querySelectorAll('.message').forEach(function(m) { m.remove(); });
    if (welcomeEl) welcomeEl.style.display = 'none';
    try {
        var res = await fetch('/api/sessions/' + sid + '/messages');
        var msgs = await res.json();
        msgs.forEach(function(m) { addMessage(m.content, m.role, null, true); });
        scrollToBottom();
    } catch(e) {}
    loadSessions();
    sidebarEl.classList.remove('open'); overlayEl.classList.remove('active');
}

// ========== Sohbet Basligini Duzenleme ==========
function startRenameSession(sid) {
    var item = document.querySelector('.session-item[data-session-id="' + sid + '"]');
    if (!item) return;
    var titleEl = item.querySelector('.session-title');
    if (!titleEl) return;
    var currentTitle = titleEl.textContent;
    var input = document.createElement('input');
    input.className = 'session-rename-input';
    input.value = currentTitle;
    titleEl.replaceWith(input);
    input.focus();
    input.select();

    function save() {
        var newTitle = input.value.trim();
        if (newTitle && newTitle !== currentTitle) {
            fetch('/api/sessions/' + sid + '/title', {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({title: newTitle, user_id: userId})
            }).then(function() { loadSessions(); });
        } else {
            loadSessions();
        }
    }
    input.onblur = save;
    input.onkeydown = function(e) {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') loadSessions();
    };
}

async function deleteSession(sid) {
    try {
        await fetch('/api/sessions/' + sid + '?user_id=' + (userId || ''), { method: 'DELETE' });
        if (sid === sessionId) newChat();
        loadSessions();
        loadTrashCount();
    } catch(e) {}
}

function newChat() {
    sessionId = null;
    closeRecipeViewer();
    closeProfilePanel();
    closeTrashPanel();
    document.getElementById('chatContainer').style.display = '';
    messagesEl.querySelectorAll('.message').forEach(function(m) { m.remove(); });
    if (welcomeEl) welcomeEl.style.display = '';
    document.querySelectorAll('.category-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelector('.category-tab').classList.add('active');
    renderSuggestions();
    loadSessions();
    inputEl.focus();
    sidebarEl.classList.remove('open'); overlayEl.classList.remove('active');
}

// ========== Tarif Defteri Agaci ==========
async function loadBookTree() {
    try {
        var res = await fetch('/api/books-tree?user_id=' + userId);
        var books = await res.json();
        bookTreeEl.innerHTML = '';
        if (books.length === 0) {
            bookTreeEl.innerHTML = '<div class="empty-state">Henuz tarif defterin yok.<br>Sohbette tarifleri favorile!</div>';
            return;
        }
        books.forEach(function(b) {
            var bookDiv = document.createElement('div');
            bookDiv.className = 'book-item';

            var header = document.createElement('div');
            header.className = 'book-header';
            header.innerHTML = '<span class="book-name">\uD83D\uDCD6 ' + DOMPurify.sanitize(b.name) + '</span>';

            var actions = document.createElement('div');
            actions.className = 'book-actions';
            var pdfBtn = document.createElement('button');
            pdfBtn.textContent = '\uD83D\uDCC4';
            pdfBtn.title = 'PDF Indir';
            pdfBtn.onclick = function(e) { e.stopPropagation(); window.location = '/api/books/' + b.id + '/export-pdf'; };
            actions.appendChild(pdfBtn);
            var delBtn = document.createElement('button');
            delBtn.textContent = '\uD83D\uDDD1';
            delBtn.title = 'Defteri Sil';
            delBtn.onclick = function(e) { e.stopPropagation(); confirmDelete('Bu defteri silmek istediginize emin misiniz?', function() { deleteBook(b.id); }); };
            actions.appendChild(delBtn);
            header.appendChild(actions);

            header.onclick = function() { bookDiv.classList.toggle('expanded'); };
            bookDiv.appendChild(header);

            var foldersDiv = document.createElement('div');
            foldersDiv.className = 'book-folders';
            if (b.folders.length === 0) {
                foldersDiv.innerHTML = '<div class="empty-folder">Klasor yok</div>';
            }
            b.folders.forEach(function(f) {
                var folderDiv = document.createElement('div');
                folderDiv.className = 'folder-item';
                folderDiv.innerHTML = '\uD83D\uDCC1 ' + DOMPurify.sanitize(f.name) + ' <span class="folder-count">(' + f.recipe_count + ')</span>';
                folderDiv.onclick = function(e) { e.stopPropagation(); openFolder(f.id, f.name, b.id, b.name); };

                var fDelBtn = document.createElement('button');
                fDelBtn.className = 'folder-delete';
                fDelBtn.textContent = '\u2715';
                fDelBtn.onclick = function(e) { e.stopPropagation(); confirmDelete('Bu klasoru silmek istediginize emin misiniz?', function() { deleteFolder(f.id); }); };
                folderDiv.appendChild(fDelBtn);

                foldersDiv.appendChild(folderDiv);
            });
            bookDiv.appendChild(foldersDiv);
            bookTreeEl.appendChild(bookDiv);
        });
    } catch(e) {}
}

async function deleteBook(id) {
    await fetch('/api/books/' + id + '?user_id=' + (userId || ''), { method: 'DELETE' });
    showToast('Defter silindi');
    loadBookTree();
}

async function deleteFolder(id) {
    await fetch('/api/folders/' + id, { method: 'DELETE' });
    showToast('Klasor silindi');
    loadBookTree();
}

function promptNewBook() {
    var name = prompt('Yeni defter adi:');
    if (!name) return;
    fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, name: name })
    }).then(function() { loadBookTree(); showToast('Defter olusturuldu!'); });
}

// ========== Kayitli Tariflerde Arama ==========
var searchTimeout = null;
function searchSavedRecipes() {
    var q = document.getElementById('bookSearchInput').value.trim();
    var resultsEl = document.getElementById('bookSearchResults');
    if (q.length < 2) {
        resultsEl.style.display = 'none';
        bookTreeEl.style.display = '';
        return;
    }
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async function() {
        try {
            var res = await fetch('/api/saved-recipes/search?user_id=' + userId + '&q=' + encodeURIComponent(q));
            var results = await res.json();
            resultsEl.innerHTML = '';
            if (results.length === 0) {
                resultsEl.innerHTML = '<div class="empty-state">Sonuc bulunamadi</div>';
            } else {
                results.forEach(function(r) {
                    var item = document.createElement('div');
                    item.className = 'search-result-item';
                    item.textContent = r.title;
                    item.onclick = function() {
                        // Open the folder containing this recipe
                        // For simplicity just show a toast
                        showToast('Tarif: ' + r.title);
                    };
                    resultsEl.appendChild(item);
                });
            }
            resultsEl.style.display = '';
            bookTreeEl.style.display = 'none';
        } catch(e) {
            resultsEl.innerHTML = '<div class="empty-state">Arama hatasi</div>';
            resultsEl.style.display = '';
        }
    }, 300);
}

// ========== Tarif Puanlama (Star Rating) ==========
function createStarRating(recipeId, currentRating) {
    var container = document.createElement('div');
    container.className = 'star-rating';
    for (var i = 1; i <= 5; i++) {
        var star = document.createElement('span');
        star.className = 'star' + (i <= (currentRating || 0) ? ' active' : '');
        star.textContent = '\u2605';
        star.setAttribute('data-value', i);
        (function(val) {
            star.onclick = function() {
                fetch('/api/saved-recipes/' + recipeId + '/rate', {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({rating: val})
                }).then(function() {
                    container.querySelectorAll('.star').forEach(function(s) {
                        s.classList.toggle('active', parseInt(s.getAttribute('data-value')) <= val);
                    });
                    showToast(val + ' yildiz verildi!');
                });
            };
        })(i);
        container.appendChild(star);
    }
    return container;
}

// ========== Tarif Goruntuleme ==========
var currentViewFolderId = null;

async function openFolder(folderId, folderName, bookId, bookName) {
    currentViewBookId = bookId;
    currentViewFolderId = folderId;
    document.getElementById('chatContainer').style.display = 'none';
    var viewer = document.getElementById('recipeViewer');
    viewer.style.display = 'flex';
    document.getElementById('viewerTitle').textContent = bookName + ' / ' + folderName;

    var content = document.getElementById('viewerContent');
    content.innerHTML = '<p>Yukleniyor...</p>';

    try {
        var res = await fetch('/api/folders/' + folderId + '/recipes');
        var recipes = await res.json();
        if (recipes.length === 0) {
            content.innerHTML = '<div class="empty-state">Bu klasorde tarif yok.</div>';
            return;
        }
        content.innerHTML = '';

        // Klasor PDF butonu
        var folderPdfBtn = document.createElement('button');
        folderPdfBtn.className = 'folder-pdf-btn';
        folderPdfBtn.textContent = '\uD83D\uDCC4 Klasoru PDF Indir';
        folderPdfBtn.onclick = function() { window.location = '/api/folders/' + folderId + '/export-pdf'; };
        content.appendChild(folderPdfBtn);

        recipes.forEach(function(r) {
            var card = document.createElement('div');
            card.className = 'recipe-card';
            card.setAttribute('data-recipe-id', r.id);
            var cardHeader = document.createElement('div');
            cardHeader.className = 'recipe-card-header';
            cardHeader.innerHTML = '<strong>' + DOMPurify.sanitize(r.title) + '</strong>';

            var cardActions = document.createElement('div');
            cardActions.className = 'recipe-card-actions';

            // Paylas butonu
            var shareBtn = document.createElement('button');
            shareBtn.className = 'recipe-card-share';
            shareBtn.textContent = '\uD83D\uDD17';
            shareBtn.title = 'Paylas';
            shareBtn.onclick = function() { shareRecipe(r.id); };
            cardActions.appendChild(shareBtn);

            // Duzenle butonu
            var editBtn = document.createElement('button');
            editBtn.className = 'recipe-card-edit';
            editBtn.textContent = '\u270F\uFE0F';
            editBtn.title = 'Duzenle';
            editBtn.onclick = function() { startEditRecipe(card, r); };
            cardActions.appendChild(editBtn);

            // Tek tarif PDF
            var pdfBtn = document.createElement('button');
            pdfBtn.className = 'recipe-card-pdf';
            pdfBtn.textContent = '\uD83D\uDCC4';
            pdfBtn.title = 'PDF Indir';
            pdfBtn.onclick = function() { window.location = '/api/saved-recipes/' + r.id + '/export-pdf'; };
            cardActions.appendChild(pdfBtn);

            // Sil
            var delBtn = document.createElement('button');
            delBtn.className = 'recipe-card-delete';
            delBtn.textContent = '\uD83D\uDDD1';
            delBtn.onclick = function() {
                confirmDelete('Bu tarifi silmek istediginize emin misiniz?', function() {
                    fetch('/api/saved-recipes/' + r.id, { method: 'DELETE' }).then(function() {
                        card.remove();
                        showToast('Tarif silindi');
                        loadBookTree();
                    });
                });
            };
            cardActions.appendChild(delBtn);
            cardHeader.appendChild(cardActions);
            card.appendChild(cardHeader);

            // Star rating
            card.appendChild(createStarRating(r.id, r.rating));

            var body = document.createElement('div');
            body.className = 'recipe-card-body';
            body.innerHTML = safeMarkdown(r.content);
            card.appendChild(body);

            // Shopping list button
            var shopBtn = document.createElement('button');
            shopBtn.className = 'recipe-card-shopping-btn';
            shopBtn.textContent = '\uD83D\uDED2 Alisveris Listesine Ekle';
            (function(recipeContent) {
                shopBtn.onclick = function() { addToShoppingList(recipeContent); };
            })(r.content);
            card.appendChild(shopBtn);

            content.appendChild(card);
        });
    } catch(e) { content.innerHTML = '<p>Hata olustu.</p>'; }

    sidebarEl.classList.remove('open'); overlayEl.classList.remove('active');
}

// ========== Tarif Paylasimi ==========
async function shareRecipe(recipeId) {
    try {
        var res = await fetch('/api/saved-recipes/' + recipeId + '/share', { method: 'POST' });
        var data = await res.json();
        if (data.share_url) {
            navigator.clipboard.writeText(data.share_url).then(function() {
                showToast('Paylasim linki kopyalandi!');
            }).catch(function() {
                prompt('Paylasim linki:', data.share_url);
            });
        }
    } catch(e) {
        showToast('Paylasim linki olusturulamadi');
    }
}

// ========== Tarif Duzenleme ==========
function startEditRecipe(card, recipe) {
    var body = card.querySelector('.recipe-card-body');
    var currentContent = recipe.content;
    var currentTitle = recipe.title;

    // Replace body with edit form
    var editDiv = document.createElement('div');
    editDiv.className = 'recipe-edit-form';

    var titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'recipe-edit-title';
    titleInput.value = currentTitle;
    editDiv.appendChild(titleInput);

    var textarea = document.createElement('textarea');
    textarea.className = 'recipe-edit-textarea';
    textarea.value = currentContent;
    textarea.rows = 15;
    editDiv.appendChild(textarea);

    var btnRow = document.createElement('div');
    btnRow.className = 'recipe-edit-buttons';

    var saveBtn = document.createElement('button');
    saveBtn.className = 'recipe-edit-save';
    saveBtn.textContent = 'Kaydet';
    saveBtn.onclick = async function() {
        var newTitle = titleInput.value.trim();
        var newContent = textarea.value.trim();
        if (!newTitle || !newContent) { showToast('Baslik ve icerik bos olamaz'); return; }
        try {
            var res = await fetch('/api/saved-recipes/' + recipe.id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle, content: newContent })
            });
            var updated = await res.json();
            recipe.title = updated.title;
            recipe.content = updated.content;
            // Restore card view
            card.querySelector('.recipe-card-header strong').textContent = updated.title;
            body.innerHTML = safeMarkdown(updated.content);
            editDiv.replaceWith(body);
            showToast('Tarif guncellendi!');
            loadBookTree();
        } catch(e) {
            showToast('Guncelleme hatasi');
        }
    };
    btnRow.appendChild(saveBtn);

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'recipe-edit-cancel';
    cancelBtn.textContent = 'Iptal';
    cancelBtn.onclick = function() {
        editDiv.replaceWith(body);
    };
    btnRow.appendChild(cancelBtn);

    editDiv.appendChild(btnRow);
    body.replaceWith(editDiv);
}

function closeRecipeViewer() {
    document.getElementById('recipeViewer').style.display = 'none';
    document.getElementById('chatContainer').style.display = '';
}

// ========== Profile Panel (Feature 2) ==========
async function openProfilePanel() {
    if (!userId) return;
    document.getElementById('chatContainer').style.display = 'none';
    document.getElementById('recipeViewer').style.display = 'none';
    document.getElementById('trashPanel').style.display = 'none';
    document.getElementById('profilePanel').style.display = 'flex';

    // Load profile data
    try {
        var res = await fetch('/api/auth/profile?user_id=' + userId);
        var data = await res.json();
        document.getElementById('profileInfoUserId').textContent = data.user_id || '-';
        document.getElementById('profileInfoCreatedAt').textContent = data.created_at ? new Date(data.created_at).toLocaleDateString('tr-TR', {year:'numeric', month:'long', day:'numeric'}) : '-';
        document.getElementById('profileNewUsername').value = data.username || '';
    } catch(e) {}

    document.getElementById('profileOldPassword').value = '';
    document.getElementById('profileNewPassword').value = '';
    var usernameErr = document.getElementById('profileUsernameError');
    var passwordErr = document.getElementById('profilePasswordError');
    if (usernameErr) usernameErr.style.display = 'none';
    if (passwordErr) passwordErr.style.display = 'none';

    // Close sidebar on mobile
    sidebarEl.classList.remove('open');
    overlayEl.classList.remove('active');
}

function closeProfilePanel() {
    document.getElementById('profilePanel').style.display = 'none';
    document.getElementById('chatContainer').style.display = '';
}

async function saveProfileUsername() {
    var newUsername = document.getElementById('profileNewUsername').value.trim();
    var errEl = document.getElementById('profileUsernameError');
    if (!newUsername || newUsername.length < 3) {
        errEl.textContent = 'Kullanici adi en az 3 karakter olmali';
        errEl.style.display = 'block';
        return;
    }
    try {
        var res = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, username: newUsername })
        });
        var data = await res.json();
        if (!res.ok) {
            errEl.textContent = data.error || 'Bir hata olustu';
            errEl.style.display = 'block';
            return;
        }
        currentUsername = data.username;
        localStorage.setItem('username', currentUsername);
        updateProfileUI();
        errEl.style.display = 'none';
        showToast('Kullanici adi guncellendi!');
    } catch(e) {
        errEl.textContent = 'Baglanti hatasi';
        errEl.style.display = 'block';
    }
}

async function saveProfilePassword() {
    var oldPw = document.getElementById('profileOldPassword').value;
    var newPw = document.getElementById('profileNewPassword').value;
    var errEl = document.getElementById('profilePasswordError');
    if (!oldPw || !newPw) {
        errEl.textContent = 'Her iki sifre alani da doldurulmali';
        errEl.style.display = 'block';
        return;
    }
    if (newPw.length < 4) {
        errEl.textContent = 'Yeni sifre en az 4 karakter olmali';
        errEl.style.display = 'block';
        return;
    }
    try {
        var res = await fetch('/api/auth/password', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, old_password: oldPw, new_password: newPw })
        });
        var data = await res.json();
        if (!res.ok) {
            errEl.textContent = data.error || 'Bir hata olustu';
            errEl.style.display = 'block';
            return;
        }
        document.getElementById('profileOldPassword').value = '';
        document.getElementById('profileNewPassword').value = '';
        errEl.style.display = 'none';
        showToast('Sifre basariyla degistirildi!');
    } catch(e) {
        errEl.textContent = 'Baglanti hatasi';
        errEl.style.display = 'block';
    }
}

// ========== Cop Kutusu / Trash (Feature 3) ==========
var trashCount = 0;

async function loadTrashCount() {
    try {
        var res = await fetch('/api/trash?user_id=' + (userId || ''));
        var items = await res.json();
        trashCount = items.length;
        var badge = document.getElementById('trashBadge');
        if (badge) {
            badge.textContent = trashCount;
            badge.style.display = trashCount > 0 ? 'inline-flex' : 'none';
        }
    } catch(e) { trashCount = 0; }
}

async function openTrashPanel() {
    document.getElementById('chatContainer').style.display = 'none';
    document.getElementById('recipeViewer').style.display = 'none';
    document.getElementById('profilePanel').style.display = 'none';
    document.getElementById('trashPanel').style.display = 'flex';

    var content = document.getElementById('trashPanelContent');
    content.innerHTML = '<p>Yukleniyor...</p>';

    try {
        var res = await fetch('/api/trash?user_id=' + (userId || ''));
        var items = await res.json();
        content.innerHTML = '';

        if (items.length === 0) {
            content.innerHTML = '<div class="empty-state">Cop kutusu bos.</div>';
            return;
        }

        items.forEach(function(item) {
            var card = document.createElement('div');
            card.className = 'recipe-card trash-card';

            var cardHeader = document.createElement('div');
            cardHeader.className = 'recipe-card-header';

            var titleEl = document.createElement('strong');
            titleEl.textContent = item.title;
            cardHeader.appendChild(titleEl);

            var cardActions = document.createElement('div');
            cardActions.className = 'recipe-card-actions';

            // Restore button
            var restoreBtn = document.createElement('button');
            restoreBtn.className = 'trash-restore-btn';
            restoreBtn.textContent = 'Kurtar';
            restoreBtn.onclick = function() { restoreSession(item.session_id); };
            cardActions.appendChild(restoreBtn);

            // Permanent delete
            var permDelBtn = document.createElement('button');
            permDelBtn.className = 'trash-permdelete-btn';
            permDelBtn.textContent = 'Kalici Sil';
            permDelBtn.onclick = function() {
                confirmDelete('Bu sohbeti kalici olarak silmek istediginize emin misiniz? Bu islem geri alinamaz.', function() {
                    permanentDeleteSession(item.session_id);
                });
            };
            cardActions.appendChild(permDelBtn);

            cardHeader.appendChild(cardActions);
            card.appendChild(cardHeader);

            // Deleted date
            if (item.deleted_at) {
                var dateEl = document.createElement('div');
                dateEl.className = 'trash-date';
                dateEl.textContent = 'Silindi: ' + new Date(item.deleted_at).toLocaleDateString('tr-TR', {year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
                card.appendChild(dateEl);
            }

            content.appendChild(card);
        });
    } catch(e) {
        content.innerHTML = '<p>Hata olustu.</p>';
    }

    sidebarEl.classList.remove('open');
    overlayEl.classList.remove('active');
}

function closeTrashPanel() {
    document.getElementById('trashPanel').style.display = 'none';
    document.getElementById('chatContainer').style.display = '';
}

async function restoreSession(sessionId) {
    try {
        await fetch('/api/trash/' + sessionId + '/restore', { method: 'POST' });
        showToast('Sohbet geri yuklendi!');
        openTrashPanel();
        loadSessions();
        loadTrashCount();
    } catch(e) { showToast('Geri yukleme hatasi'); }
}

async function permanentDeleteSession(sessionId) {
    try {
        await fetch('/api/trash/' + sessionId + '/permanent', { method: 'DELETE' });
        showToast('Sohbet kalici olarak silindi');
        openTrashPanel();
        loadTrashCount();
    } catch(e) { showToast('Silme hatasi'); }
}

async function emptyTrash() {
    confirmDelete('Cop kutusundaki tum sohbetler kalici olarak silinecek. Emin misiniz?', async function() {
        try {
            await fetch('/api/trash/empty?user_id=' + (userId || ''), { method: 'DELETE' });
            showToast('Cop kutusu bosaltildi');
            openTrashPanel();
            loadTrashCount();
        } catch(e) { showToast('Bosaltma hatasi'); }
    });
}

function exportCurrentPdf() {
    if (currentViewBookId) window.location = '/api/books/' + currentViewBookId + '/export-pdf';
}

// ========== Favorile Modal ==========
var favContent = '';
var favTreeData = [];

function openFavModal(recipeText) {
    favContent = recipeText;
    document.getElementById('favModal').style.display = 'flex';
    // Basliktan tarif adini cikar
    var titleMatch = recipeText.match(/^#{1,3}\s+(.+)$/m) || recipeText.match(/\*\*(.+?)\*\*/);
    document.getElementById('favTitle').value = titleMatch ? titleMatch[1].trim() : '';
    document.getElementById('favNewBookInput').style.display = 'none';
    document.getElementById('favNewFolderInput').style.display = 'none';
    loadFavTree();
}

function closeFavModal() { document.getElementById('favModal').style.display = 'none'; }

async function loadFavTree() {
    var res = await fetch('/api/books-tree?user_id=' + userId);
    favTreeData = await res.json();
    var bookSel = document.getElementById('favBookSelect');
    bookSel.innerHTML = '<option value="">-- Defter secin --</option>';
    favTreeData.forEach(function(b) {
        bookSel.innerHTML += '<option value="' + b.id + '">' + DOMPurify.sanitize(b.name) + '</option>';
    });
    bookSel.onchange = function() { updateFolderSelect(bookSel.value); };
    document.getElementById('favFolderSelect').innerHTML = '<option value="">-- Once defter secin --</option>';
}

function updateFolderSelect(bookId) {
    var folderSel = document.getElementById('favFolderSelect');
    folderSel.innerHTML = '<option value="">-- Klasor secin --</option>';
    var book = favTreeData.find(function(b) { return b.id == bookId; });
    if (book) {
        book.folders.forEach(function(f) {
            folderSel.innerHTML += '<option value="' + f.id + '">' + DOMPurify.sanitize(f.name) + '</option>';
        });
    }
}

function inlineNewBook() {
    var inp = document.getElementById('favNewBookInput');
    inp.style.display = inp.style.display === 'none' ? '' : 'none';
    inp.focus();
    inp.onkeydown = async function(e) {
        if (e.key === 'Enter' && inp.value.trim()) {
            await fetch('/api/books', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, name: inp.value.trim() })
            });
            inp.value = '';
            inp.style.display = 'none';
            await loadFavTree();
            // Son eklenen defteri sec
            var sel = document.getElementById('favBookSelect');
            sel.value = sel.options[sel.options.length - 1].value;
            updateFolderSelect(sel.value);
        }
    };
}

function inlineNewFolder() {
    var bookId = document.getElementById('favBookSelect').value;
    if (!bookId) { showToast('Once bir defter secin'); return; }
    var inp = document.getElementById('favNewFolderInput');
    inp.style.display = inp.style.display === 'none' ? '' : 'none';
    inp.focus();
    inp.onkeydown = async function(e) {
        if (e.key === 'Enter' && inp.value.trim()) {
            await fetch('/api/books/' + bookId + '/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: inp.value.trim() })
            });
            inp.value = '';
            inp.style.display = 'none';
            await loadFavTree();
            document.getElementById('favBookSelect').value = bookId;
            updateFolderSelect(bookId);
            var fSel = document.getElementById('favFolderSelect');
            fSel.value = fSel.options[fSel.options.length - 1].value;
        }
    };
}

async function saveFavorite() {
    var title = document.getElementById('favTitle').value.trim();
    var bookId = document.getElementById('favBookSelect').value;
    var folderId = document.getElementById('favFolderSelect').value;
    if (!title) { showToast('Tarif adi girin'); return; }
    if (!bookId) { showToast('Bir defter secin'); return; }

    if (folderId) {
        // Klasor secildiyse direkt klasore kaydet
        await fetch('/api/folders/' + folderId + '/recipes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title, content: favContent, source_session: sessionId })
        });
    } else {
        // Klasor secilmediyse deftere direkt kaydet ("Genel" klasorune)
        await fetch('/api/books/' + bookId + '/save-recipe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title, content: favContent, source_session: sessionId })
        });
    }
    closeFavModal();
    showToast('Tarif kaydedildi!');
    loadBookTree();
}

// ========== Rotating Welcome Suggestions ==========
var allSuggestions = [
    {text: 'Karniyarik nasil yapilir?', label: 'Karniyarik'},
    {text: 'Mercimek corbasi tarifi verir misin?', label: 'Mercimek Corbasi'},
    {text: 'Baklava tarifi istiyorum', label: 'Baklava'},
    {text: 'Manti nasil yapilir?', label: 'Manti'},
    {text: 'Iskender kebap tarifi ver', label: 'Iskender Kebap'},
    {text: 'Hunkar begendi nasil yapilir?', label: 'Hunkar Begendi'},
    {text: 'Icli kofte tarifi', label: 'Icli Kofte'},
    {text: 'Cilbir nasil yapilir?', label: 'Cilbir'},
    {text: 'Kunefe tarifi istiyorum', label: 'Kunefe'},
    {text: 'Sutlac nasil yapilir?', label: 'Sutlac'},
    {text: 'Ezogelin corbasi tarifi', label: 'Ezogelin Corbasi'},
    {text: 'Lahmacun nasil yapilir?', label: 'Lahmacun'},
    {text: 'Pide tarifi verir misin?', label: 'Pide'},
    {text: 'Kuzu tandir nasil yapilir?', label: 'Kuzu Tandir'},
    {text: 'Menemen tarifi', label: 'Menemen'},
    {text: 'Yaprak sarmasi nasil yapilir?', label: 'Yaprak Sarmasi'},
    {text: 'Keskek tarifi istiyorum', label: 'Keskek'},
    {text: 'Gozleme nasil yapilir?', label: 'Gozleme'},
    {text: 'Asure tarifi ver', label: 'Asure'},
    {text: 'Adana kebap nasil yapilir?', label: 'Adana Kebap'},
    {text: 'Imam bayildi tarifi', label: 'Imam Bayildi'},
    {text: 'Ali nazik nasil yapilir?', label: 'Ali Nazik'},
    {text: 'Coban salata tarifi', label: 'Coban Salata'},
    {text: 'Kisir nasil yapilir?', label: 'Kisir'},
    {text: 'Tas kebabi tarifi ver', label: 'Tas Kebabi'},
    {text: 'Kabak mucver nasil yapilir?', label: 'Kabak Mucver'},
    {text: 'Havuc tarator tarifi', label: 'Havuc Tarator'},
    {text: 'Etli nohut yemegi tarifi', label: 'Etli Nohut'},
    {text: 'Kadayif dolmasi nasil yapilir?', label: 'Kadayif Dolmasi'},
    {text: 'Kuymak (muhlama) tarifi', label: 'Kuymak'},
    {text: 'Testi kebabi nasil yapilir?', label: 'Testi Kebabi'},
    {text: 'Tulumba tatlisi tarifi', label: 'Tulumba'},
    {text: 'Firinda kuzu pirzola nasil yapilir?', label: 'Kuzu Pirzola'},
    {text: 'Tavuk sote tarifi', label: 'Tavuk Sote'},
    {text: 'Domates corbasi nasil yapilir?', label: 'Domates Corbasi'},
];

function getRandomSuggestions(count) {
    var shuffled = allSuggestions.slice().sort(function() { return 0.5 - Math.random(); });
    return shuffled.slice(0, count);
}

function renderSuggestions() {
    var container = document.getElementById('suggestionButtons');
    if (!container) return;
    container.innerHTML = '';
    var picks = getRandomSuggestions(5);
    picks.forEach(function(s) {
        var btn = document.createElement('button');
        btn.textContent = s.label;
        btn.onclick = function() { sendSuggestion(s.text); };
        container.appendChild(btn);
    });
}

// ========== Kategori & Oneri ==========
function filterCategory(category, btn) {
    document.querySelectorAll('.category-tab').forEach(function(t) { t.classList.remove('active'); });
    btn.classList.add('active');
    if (category === 'all') return;
    var msgs = { 'Corba':'Corba tarifleri oner misin?', 'Ana Yemek':'Ana yemek tarifleri neler var?', 'Tatli':'Tatli tarifleri oner misin?', 'Meze':'Meze tarifleri oner misin?', 'Kahvaltilik':'Kahvaltilik tarifleri neler?' };
    inputEl.value = msgs[category] || category + ' tarifleri oner misin?';
    sendMessage();
}
function sendSuggestion(text) { inputEl.value = text; sendMessage(); }

// ========== Scroll ==========
messagesEl.addEventListener('scroll', function() {
    var dist = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight;
    scrollBtn.style.display = dist > 150 ? 'flex' : 'none';
});
inputEl.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !sendBtn.disabled) sendMessage(); });

// ========== Buton Olusturucular ==========
function createCopyBtn(text) {
    var btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = '\uD83D\uDCCB';
    btn.title = 'Kopyala';
    btn.onclick = function() {
        navigator.clipboard.writeText(text).then(function() {
            btn.textContent = '\u2705';
            setTimeout(function() { btn.textContent = '\uD83D\uDCCB'; }, 2000);
        });
    };
    return btn;
}

function createFavBtn(text) {
    var btn = document.createElement('button');
    btn.className = 'fav-btn';
    btn.textContent = '\u2764\uFE0F';
    btn.title = 'Favorile';
    btn.onclick = function() { openFavModal(text); };
    return btn;
}

// ========== "Daha Detayli Anlat" Butonu ==========
function createDetailBtn(text) {
    var btn = document.createElement('button');
    btn.className = 'detail-btn';
    btn.textContent = 'Daha detayli anlat';
    btn.onclick = function() {
        var snippet = text.substring(0, 50);
        inputEl.value = 'Bu tarifi daha detayli anlat: ' + snippet;
        sendMessage();
    };
    return btn;
}

// ========== Porsiyon Hesapla Butonu ==========
function createPortionBtn(text) {
    var btn = document.createElement('button');
    btn.className = 'portion-btn';
    btn.textContent = 'Porsiyon Hesapla';
    btn.onclick = function() {
        var count = prompt('Kac kisilik?');
        if (count && !isNaN(parseInt(count))) {
            var n = parseInt(count);
            inputEl.value = 'Bu tarifi ' + n + ' kisilik yap, malzeme miktarlarini ' + n + ' kisiye gore ayarla';
            sendMessage();
        }
    };
    return btn;
}

// ========== Streaming Mesaj Gonder ==========
async function sendMessage() {
    var message = inputEl.value.trim();
    if (!message) return;
    if (welcomeEl) welcomeEl.style.display = 'none';
    closeRecipeViewer();
    closeProfilePanel();
    closeTrashPanel();
    document.getElementById('chatContainer').style.display = '';

    addMessage(message, 'user');
    inputEl.value = '';
    sendBtn.disabled = true;
    typingEl.classList.add('active');
    scrollToBottom();

    var assistantDiv = document.createElement('div');
    assistantDiv.className = 'message assistant';
    var contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    assistantDiv.appendChild(contentDiv);

    try {
        var res = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message, session_id: sessionId, user_id: userId })
        });
        typingEl.classList.remove('active');
        messagesEl.insertBefore(assistantDiv, typingEl);

        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var fullText = '';
        var references = [];
        var buffer = '';

        while (true) {
            var result = await reader.read();
            if (result.done) break;
            buffer += decoder.decode(result.value, { stream: true });
            var lines = buffer.split('\n');
            buffer = lines.pop();
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (!line.startsWith('data: ')) continue;
                try {
                    var data = JSON.parse(line.substring(6));
                    if (data.type === 'session_id') { sessionId = data.session_id; }
                    else if (data.type === 'token') { fullText += data.token; contentDiv.innerHTML = safeMarkdown(fullText); scrollToBottom(); }
                    else if (data.type === 'references') { references = data.references || []; }
                    else if (data.type === 'done') {
                        // Action buttons row (copy, fav)
                        var btnWrap = document.createElement('div');
                        btnWrap.className = 'msg-actions';
                        btnWrap.appendChild(createCopyBtn(fullText));
                        btnWrap.appendChild(createFavBtn(fullText));
                        assistantDiv.appendChild(btnWrap);

                        // Extra action buttons row (detail, portion)
                        var extraWrap = document.createElement('div');
                        extraWrap.className = 'msg-extra-actions';
                        extraWrap.appendChild(createDetailBtn(fullText));
                        extraWrap.appendChild(createPortionBtn(fullText));
                        assistantDiv.appendChild(extraWrap);

                        if (references.length > 0) {
                            var refDiv = document.createElement('div');
                            refDiv.className = 'references';
                            refDiv.innerHTML = '<span class="ref-title">Kaynak Siteler:</span>';
                            references.forEach(function(url) {
                                var a = document.createElement('a');
                                a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
                                try { a.textContent = new URL(url).hostname.replace('www.', ''); } catch(e) { a.textContent = url; }
                                refDiv.appendChild(a);
                            });
                            assistantDiv.appendChild(refDiv);
                        }
                        // Cache badge indicator
                        if (data.cached) {
                            var cacheBadge = document.createElement('div');
                            cacheBadge.className = 'cache-badge';
                            cacheBadge.textContent = 'Onbellekten yuklendi';
                            assistantDiv.appendChild(cacheBadge);
                        }

                        loadSessions();
                    }
                } catch(e) {}
            }
        }
    } catch (err) {
        typingEl.classList.remove('active');
        contentDiv.textContent = 'Bir hata olustu. Lutfen tekrar deneyin.';
        messagesEl.insertBefore(assistantDiv, typingEl);
    } finally { sendBtn.disabled = false; inputEl.focus(); scrollToBottom(); }
}

// ========== Gecmis Mesaj Ekleme ==========
function addMessage(text, role, references, isHistory) {
    var div = document.createElement('div');
    div.className = 'message ' + role;
    if (role === 'assistant') {
        var cd = document.createElement('div');
        cd.className = 'message-content';
        cd.innerHTML = safeMarkdown(text);
        div.appendChild(cd);
        var btnWrap = document.createElement('div');
        btnWrap.className = 'msg-actions';
        btnWrap.appendChild(createCopyBtn(text));
        btnWrap.appendChild(createFavBtn(text));
        div.appendChild(btnWrap);

        // Extra action buttons for history messages too
        var extraWrap = document.createElement('div');
        extraWrap.className = 'msg-extra-actions';
        extraWrap.appendChild(createDetailBtn(text));
        extraWrap.appendChild(createPortionBtn(text));
        div.appendChild(extraWrap);
    } else { div.textContent = text; }
    messagesEl.insertBefore(div, typingEl);
    if (!isHistory) scrollToBottom();
}

// ========== Haftalik Menu Planlayici ==========
function requestMenuPlan() {
    var prefs = prompt('Tercihleriniz var mi? (ornek: sebze agirlikli, cocuklar icin) - Bos birakabilirsiniz');
    var msg = 'Bana 7 gunluk bir Turk mutfagi haftalik menu plani hazirla. Her gun icin kahvalti, ogle ve aksam yemegi onerisi ver.';
    if (prefs && prefs.trim()) {
        msg += ' Tercihlerim: ' + prefs.trim();
    }
    inputEl.value = msg;
    sendMessage();
}

// ========== Malzeme ile Tarif Bul (Sidebar) ==========
function openIngredientsTab() {
    // Open sidebar ingredients tab
    var tabBtn = document.querySelector('.sidebar-tab[onclick*="ingredients"]');
    if (tabBtn) switchSidebarTab('ingredients', tabBtn);
    // On mobile, also open sidebar
    if (window.innerWidth <= 768) {
        sidebarEl.classList.add('open');
        overlayEl.classList.add('active');
    }
}

function addIngredientChip(ingredient) {
    var inp = document.getElementById('sidebarIngredientInput');
    var current = inp.value.trim();
    if (current && !current.endsWith(',')) {
        current += ', ';
    } else if (current) {
        current += ' ';
    }
    inp.value = current + ingredient;
    inp.focus();
}

function sidebarSearchByIngredients() {
    var ingredients = document.getElementById('sidebarIngredientInput').value.trim();
    if (!ingredients) { showToast('Malzeme girin'); return; }
    // Close sidebar on mobile
    sidebarEl.classList.remove('open');
    overlayEl.classList.remove('active');
    // Close any open panel
    closeRecipeViewer();
    closeProfilePanel();
    closeTrashPanel();
    document.getElementById('chatContainer').style.display = '';
    inputEl.value = 'Elimde su malzemeler var: ' + ingredients + '. Bunlarla yapabilecegim Turk yemegi tarifleri neler?';
    sendMessage();
}

// Keep backward compat for old ingredient modal references
function openIngredientModal() { openIngredientsTab(); }
function closeIngredientModal() { }

// Enter key in sidebar ingredient input
document.addEventListener('DOMContentLoaded', function() {
    var ingInput = document.getElementById('sidebarIngredientInput');
    if (ingInput) {
        ingInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sidebarSearchByIngredients(); }
        });
    }
});

// ========== Alisveris Listesi Toggle ==========
function toggleShoppingSection() {
    var container = document.getElementById('shoppingListContainer');
    var icon = document.getElementById('shoppingToggleIcon');
    if (container.style.display === 'none') {
        container.style.display = '';
        icon.innerHTML = '&#9660;';
        loadShoppingLists();
    } else {
        container.style.display = 'none';
        icon.innerHTML = '&#9654;';
    }
}

// ========== Alisveris Listesi ==========
async function addToShoppingList(recipeContent) {
    try {
        var res = await fetch('/api/shopping-lists/from-recipe', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({user_id: userId, recipe_content: recipeContent})
        });
        var data = await res.json();
        showToast('Alisveris listesi olusturuldu!');
        loadShoppingLists();
    } catch(e) {
        showToast('Liste olusturulamadi');
    }
}

async function loadShoppingLists() {
    var container = document.getElementById('shoppingListContainer');
    if (!container) return;
    try {
        var res = await fetch('/api/shopping-lists?user_id=' + userId);
        var lists = await res.json();
        container.innerHTML = '';
        if (!lists || lists.length === 0) {
            container.innerHTML = '<div style="font-size:12px;color:var(--text-placeholder);padding:8px 10px;">Henuz alisveris listen yok.</div>';
            return;
        }
        lists.forEach(function(list) {
            var item = document.createElement('div');
            item.className = 'shopping-list-item';
            item.textContent = '\uD83D\uDED2 ' + (list.title || 'Liste #' + list.id);
            item.onclick = function() { viewShoppingList(list.id); };

            var delBtn = document.createElement('button');
            delBtn.className = 'shopping-list-delete';
            delBtn.textContent = '\u2715';
            delBtn.onclick = function(e) {
                e.stopPropagation();
                confirmDelete('Bu alisveris listesini silmek istediginize emin misiniz?', function() {
                    fetch('/api/shopping-lists/' + list.id, { method: 'DELETE' }).then(function() {
                        showToast('Liste silindi');
                        loadShoppingLists();
                    });
                });
            };
            item.appendChild(delBtn);
            container.appendChild(item);
        });
    } catch(e) {
        container.innerHTML = '<div style="font-size:12px;color:var(--text-placeholder);padding:8px 10px;">Listeler yuklenemedi.</div>';
    }
}

var shoppingListViewerOpen = false;

async function viewShoppingList(listId) {
    try {
        var res = await fetch('/api/shopping-lists/' + listId);
        var data = await res.json();
        var items = data.items || [];
        var title = data.title || 'Alisveris Listesi';

        // Profil/tarif panelini kapat, chat'i kapat, viewer'i ac
        document.getElementById('chatContainer').style.display = 'none';
        var viewer = document.getElementById('recipeViewer');
        viewer.style.display = 'flex';
        document.getElementById('viewerTitle').textContent = title;

        var content = document.getElementById('viewerContent');
        if (items.length === 0) {
            content.innerHTML = '<div class="empty-state">Bu liste bos.</div>';
        } else {
            var html = '<div class="recipe-card"><div class="recipe-card-header"><strong>' + DOMPurify.sanitize(title) + '</strong></div>';
            html += '<div class="recipe-card-body"><ul>';
            items.forEach(function(item) { html += '<li>' + DOMPurify.sanitize(item) + '</li>'; });
            html += '</ul></div></div>';
            content.innerHTML = html;
        }

        sidebarEl.classList.remove('open');
        overlayEl.classList.remove('active');
    } catch(e) {
        showToast('Liste yuklenemedi');
    }
}

function closeShoppingListViewer() {
    // placeholder for keyboard shortcut compatibility
    shoppingListViewerOpen = false;
}

function scrollToBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }

// ========== Profile & Logout ==========
function updateProfileUI() {
    var name = localStorage.getItem('username') || 'Misafir';
    var nameEl = document.getElementById('profileName');
    var avatarEl = document.getElementById('profileAvatar');
    if (nameEl) nameEl.textContent = name;
    if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
}

function logoutUser() {
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    userId = null;
    currentUsername = '';
    sessionId = null;
    messagesEl.querySelectorAll('.message').forEach(function(m) { m.remove(); });
    if (welcomeEl) welcomeEl.style.display = '';
    updateProfileUI();
    checkAuth();
}

// ========== Klavye Kisayollari ==========
document.addEventListener('keydown', function(e) {
    var isCmd = e.metaKey || e.ctrlKey;

    // Ctrl/Cmd + N = New Chat
    if (isCmd && e.key === 'n') {
        e.preventDefault();
        newChat();
    }

    // Ctrl/Cmd + K = Focus search/input
    if (isCmd && e.key === 'k') {
        e.preventDefault();
        inputEl.focus();
    }

    // Escape = Close modals
    if (e.key === 'Escape') {
        var authModal = document.getElementById('authModal');
        if (authModal && authModal.style.display !== 'none') return; // don't close auth modal
        var moveModal = document.getElementById('moveFolderModal');
        if (moveModal) { moveModal.remove(); return; }
        closeSessionMenu();
        closeFavModal();
        closeIngredientModal();
        closeShoppingListViewer();
        closeProfilePanel();
        closeTrashPanel();
    }
});

// Init
updateProfileUI();
checkAuth();
loadSessions();
loadTrashCount();
renderSuggestions();
