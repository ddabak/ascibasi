marked.setOptions({ breaks: true, gfm: true, headerIds: false, mangle: false });

// ========== Safe HTML rendering ==========
function safeMarkdown(text) {
    return DOMPurify.sanitize(marked.parse(text));
}

// ========== Auth State ==========
var authMode = 'login'; // 'login', 'register', 'verify'
var pendingVerifyEmail = '';
var authToken = localStorage.getItem('authToken');
var userId = localStorage.getItem('userId');
var currentUsername = localStorage.getItem('username') || '';

function checkAuth() {
    if (!authToken) {
        document.getElementById('authModal').style.display = 'flex';
    }
}

// ========== Guvenli Fetch (her istekte token gonderir) ==========
function authFetch(url, options) {
    options = options || {};
    options.headers = options.headers || {};
    if (options.headers instanceof Headers) {
        if (authToken) options.headers.set('Authorization', 'Bearer ' + authToken);
    } else {
        if (authToken) options.headers['Authorization'] = 'Bearer ' + authToken;
    }
    return fetch(url, options).then(function(res) {
        if (res.status === 401 && authToken) {
            // Token gecersiz veya suresi dolmus - cikis yap
            localStorage.removeItem('authToken');
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
            authToken = null;
            userId = null;
            location.reload();
        }
        return res;
    });
}

function toggleAuthMode() {
    var registerFields = document.getElementById('registerFields');
    var passwordConfirmField = document.getElementById('passwordConfirmField');
    var verifyCodeField = document.getElementById('verifyCodeField');
    var resendCodeBtn = document.getElementById('resendCodeBtn');
    var errorEl = document.getElementById('authError');

    verifyCodeField.style.display = 'none';
    resendCodeBtn.style.display = 'none';
    errorEl.style.display = 'none';

    if (authMode === 'login') {
        authMode = 'register';
        registerFields.style.display = 'block';
        passwordConfirmField.style.display = 'block';
        document.getElementById('passwordRules').style.display = 'block';
        document.getElementById('authModalTitle').textContent = 'Kayit Ol';
        document.getElementById('authSubmitBtn').textContent = 'Kayit Ol';
        document.getElementById('authSwitchText').textContent = 'Zaten hesabin var mi?';
        document.getElementById('authSwitchBtn').textContent = 'Giris Yap';
    } else {
        authMode = 'login';
        registerFields.style.display = 'none';
        passwordConfirmField.style.display = 'none';
        document.getElementById('authModalTitle').textContent = 'Giris Yap';
        document.getElementById('authSubmitBtn').textContent = 'Giris Yap';
        document.getElementById('authSwitchText').textContent = 'Hesabin yok mu?';
        document.getElementById('authSwitchBtn').textContent = 'Kayit Ol';
    }
}

function updatePasswordRules() {
    var pw = document.getElementById('authPassword').value;
    var pw2 = document.getElementById('authPasswordConfirm').value;
    var check = '\u2705 ';
    var cross = '\u274C ';
    document.getElementById('ruleLength').innerHTML = (pw.length >= 8 ? check : cross) + 'En az 8 karakter';
    document.getElementById('ruleLower').innerHTML = (/[a-z]/.test(pw) ? check : cross) + 'En az bir kucuk harf';
    document.getElementById('ruleUpper').innerHTML = (/[A-Z]/.test(pw) ? check : cross) + 'En az bir buyuk harf';
    document.getElementById('ruleDigit').innerHTML = (/[0-9]/.test(pw) ? check : cross) + 'En az bir rakam';
    document.getElementById('ruleSpecial').innerHTML = (/[!@#$%^&*()_+\-=\[\]{};:'",.<>?\/\\|`~]/.test(pw) ? check : cross) + 'En az bir ozel karakter (!@#$%&*)';
    document.getElementById('ruleMatch').innerHTML = (pw && pw2 && pw === pw2 ? check : cross) + 'Sifreler eslesiyor';
}

function maskEmail(email) {
    var parts = email.split('@');
    if (parts.length !== 2) return email;
    var name = parts[0];
    var domain = parts[1];
    if (name.length <= 2) return name[0] + '***@' + domain;
    return name[0] + name[1] + '***@' + domain;
}

function hideGoogleSection() {
    var d = document.getElementById('authDivider'); if (d) d.style.display = 'none';
    var g = document.getElementById('googleLoginContainer'); if (g) g.style.display = 'none';
}

function showVerifyMode(email, firstName, lastName) {
    authMode = 'verify';
    pendingVerifyEmail = email;
    hideGoogleSection();
    document.getElementById('registerFields').style.display = 'none';
    document.getElementById('passwordConfirmField').style.display = 'none';
    document.getElementById('verifyCodeField').style.display = 'block';
    document.getElementById('resendCodeBtn').style.display = 'inline-block';
    document.getElementById('authModalTitle').textContent = 'E-posta Dogrulama';
    document.getElementById('authSubmitBtn').textContent = 'Dogrula';
    document.getElementById('authSwitchText').textContent = '';
    document.getElementById('authSwitchBtn').style.display = 'none';
    document.getElementById('authUsername').parentElement.querySelector('label').style.display = 'none';
    document.getElementById('authUsername').style.display = 'none';
    document.getElementById('authPassword').parentElement.querySelector('label').style.display = 'none';
    document.getElementById('authPassword').style.display = 'none';

    // Kisisel bilgi goster
    var greeting = '';
    if (firstName && lastName) {
        greeting = 'Sayin ' + firstName + ' ' + lastName + ', ';
    }
    var maskedEmail = maskEmail(email);
    document.getElementById('verifyCodeInfo').innerHTML = greeting + 'dogrulama kodu <strong>' + maskedEmail + '</strong> adresine gonderildi.';
}

function resetAuthForm() {
    document.getElementById('authUsername').style.display = '';
    document.getElementById('authPassword').style.display = '';
    var labels = document.getElementById('authModal').querySelectorAll('label');
    labels.forEach(function(l) { l.style.display = ''; });
    document.getElementById('authSwitchBtn').style.display = '';
    document.getElementById('forgotPasswordLink').style.display = '';
    document.getElementById('verifyCodeField').style.display = 'none';
    document.getElementById('resendCodeBtn').style.display = 'none';
    document.getElementById('forgotEmailField').style.display = 'none';
    document.getElementById('resetPasswordFields').style.display = 'none';
    document.getElementById('authVerifyCode').value = '';
    document.getElementById('authFirstName').value = '';
    document.getElementById('authLastName').value = '';
    document.getElementById('authBirthDate').value = '';
    document.getElementById('authEmail').value = '';
    document.getElementById('authUsername').value = '';
    document.getElementById('authPassword').value = '';
    document.getElementById('authPasswordConfirm').value = '';
    document.getElementById('passwordRules').style.display = 'none';
    var forgotEl = document.getElementById('forgotEmail');
    if (forgotEl) forgotEl.value = '';
    var resetCodeEl = document.getElementById('resetCode');
    if (resetCodeEl) resetCodeEl.value = '';
    var resetPwEl = document.getElementById('resetNewPassword');
    if (resetPwEl) resetPwEl.value = '';
    var resetPw2El = document.getElementById('resetNewPasswordConfirm');
    if (resetPw2El) resetPw2El.value = '';
    // Google login ve ayirici goster
    var divider = document.getElementById('authDivider');
    if (divider) divider.style.display = '';
    var googleContainer = document.getElementById('googleLoginContainer');
    if (googleContainer) googleContainer.style.display = '';
}

async function submitAuth() {
    var errorEl = document.getElementById('authError');

    // E-posta dogrulama modu
    if (authMode === 'verify') {
        var code = document.getElementById('authVerifyCode').value.trim();
        if (!code || code.length !== 6) {
            errorEl.textContent = '6 haneli dogrulama kodunu girin';
            errorEl.style.display = 'block';
            return;
        }
        try {
            var res = await fetch('/api/auth/verify-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: pendingVerifyEmail, code: code })
            });
            var data = await res.json();
            if (!res.ok) {
                errorEl.textContent = data.error || 'Dogrulama hatasi';
                errorEl.style.display = 'block';
                return;
            }
            authToken = data.token;
            userId = data.user_id;
            currentUsername = data.username;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('userId', userId);
            localStorage.setItem('username', currentUsername);
            document.getElementById('authModal').style.display = 'none';
            resetAuthForm();
            authMode = 'login';
            errorEl.style.display = 'none';
            showToast('Hesabiniz dogrulandi, hos geldiniz!');
            updateProfileUI();
            loadSessions();
        } catch (e) {
            errorEl.textContent = 'Baglanti hatasi';
            errorEl.style.display = 'block';
        }
        return;
    }

    // Login 2FA onay modu
    if (authMode === 'login-verify') {
        var code = document.getElementById('authVerifyCode').value.trim();
        if (!code || code.length !== 6) {
            errorEl.textContent = '6 haneli onay kodunu girin';
            errorEl.style.display = 'block';
            return;
        }
        try {
            var res = await fetch('/api/auth/login-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: pendingVerifyEmail, code: code })
            });
            var data = await res.json();
            if (!res.ok) {
                errorEl.textContent = data.error || 'Onay hatasi';
                errorEl.style.display = 'block';
                return;
            }
            authToken = data.token;
            userId = data.user_id;
            currentUsername = data.username;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('userId', userId);
            localStorage.setItem('username', currentUsername);
            document.getElementById('authModal').style.display = 'none';
            resetAuthForm();
            authMode = 'login';
            errorEl.style.display = 'none';
            showToast('Giris basarili!');
            updateProfileUI();
            loadSessions();
            loadTrashCount();
            updateMessageLimit();
        } catch (e) {
            errorEl.textContent = 'Baglanti hatasi';
            errorEl.style.display = 'block';
        }
        return;
    }

    // Sifremi unuttum - kod gonder
    if (authMode === 'forgot') {
        var forgotEmail = document.getElementById('forgotEmail').value.trim();
        if (!forgotEmail || !forgotEmail.includes('@')) {
            errorEl.textContent = 'Gecerli bir e-posta adresi girin';
            errorEl.style.display = 'block';
            return;
        }
        try {
            var res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: forgotEmail })
            });
            var data = await res.json();
            showToast('Sifirlama kodu gonderildi');
            showResetPassword(forgotEmail);
            errorEl.style.display = 'none';
        } catch (e) {
            errorEl.textContent = 'Baglanti hatasi';
            errorEl.style.display = 'block';
        }
        return;
    }

    // Sifre sifirlama - kodu dogrula ve yeni sifre belirle
    if (authMode === 'reset') {
        var resetCode = document.getElementById('resetCode').value.trim();
        var newPw = document.getElementById('resetNewPassword').value;
        var newPw2 = document.getElementById('resetNewPasswordConfirm').value;
        if (!resetCode || resetCode.length !== 6) {
            errorEl.textContent = '6 haneli sifirlama kodunu girin';
            errorEl.style.display = 'block';
            return;
        }
        if (!newPw || newPw !== newPw2) {
            errorEl.textContent = 'Sifreler eslesmiyor';
            errorEl.style.display = 'block';
            return;
        }
        try {
            var res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: pendingVerifyEmail, code: resetCode, new_password: newPw, new_password_confirm: newPw2 })
            });
            var data = await res.json();
            if (!res.ok) {
                errorEl.textContent = data.error || 'Sifirlama hatasi';
                errorEl.style.display = 'block';
                return;
            }
            showToast('Sifreniz degistirildi! Giris yapabilirsiniz.');
            resetAuthForm();
            authMode = 'login';
            toggleAuthMode(); toggleAuthMode(); // Reset UI to login
            errorEl.style.display = 'none';
        } catch (e) {
            errorEl.textContent = 'Baglanti hatasi';
            errorEl.style.display = 'block';
        }
        return;
    }

    var username = document.getElementById('authUsername').value.trim();
    var password = document.getElementById('authPassword').value.trim();

    if (!username || !password) {
        errorEl.textContent = 'Kullanici adi ve sifre gerekli';
        errorEl.style.display = 'block';
        return;
    }

    if (authMode === 'register') {
        var firstName = document.getElementById('authFirstName').value.trim();
        var lastName = document.getElementById('authLastName').value.trim();
        var birthDate = document.getElementById('authBirthDate').value;
        var email = document.getElementById('authEmail').value.trim();
        var passwordConfirm = document.getElementById('authPasswordConfirm').value.trim();

        if (!firstName || !lastName || !email) {
            errorEl.textContent = 'Tum alanlar zorunludur';
            errorEl.style.display = 'block';
            return;
        }
        if (password !== passwordConfirm) {
            errorEl.textContent = 'Sifreler eslesmiyor';
            errorEl.style.display = 'block';
            return;
        }

        try {
            var res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username,
                    first_name: firstName,
                    last_name: lastName,
                    birth_date: birthDate,
                    email: email,
                    password: password,
                    password_confirm: passwordConfirm
                })
            });
            var data = await res.json();
            if (!res.ok) {
                errorEl.textContent = data.error || 'Kayit hatasi';
                errorEl.style.display = 'block';
                return;
            }
            showToast('Dogrulama kodu e-posta adresinize gonderildi');
            showVerifyMode(email, data.first_name, data.last_name);
            errorEl.style.display = 'none';
        } catch (e) {
            errorEl.textContent = 'Baglanti hatasi';
            errorEl.style.display = 'block';
        }
        return;
    }

    // Login
    try {
        var res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username, password: password })
        });
        var data = await res.json();
        if (!res.ok) {
            if (data.needs_verification) {
                showToast('Hesabiniz henuz dogrulanmamis');
                showVerifyMode(data.email, data.first_name, data.last_name);
                errorEl.style.display = 'none';
                return;
            }
            errorEl.textContent = data.error || 'Giris hatasi';
            errorEl.style.display = 'block';
            return;
        }
        // 2FA: Onay kodu gonderildi
        if (data.needs_login_code) {
            showToast('Onay kodu e-posta adresinize gonderildi');
            showLoginVerifyMode(data.email, data.first_name, data.last_name);
            errorEl.style.display = 'none';
            return;
        }
        // Direkt giris (2FA olmadan - normalde buraya dusmez)
        authToken = data.token;
        userId = data.user_id;
        currentUsername = data.username;
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('userId', userId);
        localStorage.setItem('username', currentUsername);
        document.getElementById('authModal').style.display = 'none';
        resetAuthForm();
        errorEl.style.display = 'none';
        showToast('Giris basarili!');
        updateProfileUI();
        loadSessions();
        loadTrashCount();
        updateMessageLimit();
    } catch (e) {
        errorEl.textContent = 'Baglanti hatasi';
        errorEl.style.display = 'block';
    }
}

// ========== Login 2FA Onay Modu ==========
function showLoginVerifyMode(email, firstName, lastName) {
    authMode = 'login-verify';
    pendingVerifyEmail = email;
    hideGoogleSection();
    document.getElementById('registerFields').style.display = 'none';
    document.getElementById('passwordConfirmField').style.display = 'none';
    document.getElementById('verifyCodeField').style.display = 'block';
    document.getElementById('resendCodeBtn').style.display = 'inline-block';
    document.getElementById('authModalTitle').textContent = 'Giris Onay Kodu';
    document.getElementById('authSubmitBtn').textContent = 'Giris Yap';
    document.getElementById('authSwitchText').textContent = '';
    document.getElementById('authSwitchBtn').style.display = 'none';
    document.getElementById('forgotPasswordLink').style.display = 'none';
    document.getElementById('authUsername').style.display = 'none';
    document.getElementById('authPassword').style.display = 'none';
    // Label'lari gizle
    var labels = document.querySelectorAll('#authModal .modal-body > label');
    labels.forEach(function(l) { l.style.display = 'none'; });

    var greeting = '';
    if (firstName && lastName) greeting = 'Sayin ' + firstName + ' ' + lastName + ', ';
    var maskedEmail = maskEmail(email);
    document.getElementById('verifyCodeInfo').innerHTML = greeting + 'giris onay kodu <strong>' + maskedEmail + '</strong> adresine gonderildi.';
}

// ========== Sifremi Unuttum ==========
function showForgotPassword() {
    authMode = 'forgot';
    hideGoogleSection();
    document.getElementById('registerFields').style.display = 'none';
    document.getElementById('passwordConfirmField').style.display = 'none';
    document.getElementById('verifyCodeField').style.display = 'none';
    document.getElementById('resendCodeBtn').style.display = 'none';
    document.getElementById('forgotPasswordLink').style.display = 'none';
    document.getElementById('authModalTitle').textContent = 'Sifremi Unuttum';
    document.getElementById('authSubmitBtn').textContent = 'Kod Gonder';
    document.getElementById('authSwitchText').textContent = 'Sifreni hatirladin mi?';
    document.getElementById('authSwitchBtn').textContent = 'Giris Yap';
    document.getElementById('authSwitchBtn').style.display = '';
    document.getElementById('authUsername').style.display = 'none';
    document.getElementById('authPassword').style.display = 'none';
    // Label'lari gizle
    var labels = document.querySelectorAll('#authModal .modal-body > label');
    labels.forEach(function(l) { l.style.display = 'none'; });
    // E-posta alani goster
    document.getElementById('forgotEmailField').style.display = 'block';
    document.getElementById('authError').style.display = 'none';
}

function showResetPassword(email) {
    authMode = 'reset';
    pendingVerifyEmail = email;
    document.getElementById('forgotEmailField').style.display = 'none';
    document.getElementById('resetPasswordFields').style.display = 'block';
    document.getElementById('authModalTitle').textContent = 'Yeni Sifre Belirle';
    document.getElementById('authSubmitBtn').textContent = 'Sifreyi Degistir';
    document.getElementById('authSwitchBtn').style.display = 'none';
    document.getElementById('authSwitchText').textContent = '';

    var maskedEmail = maskEmail(email);
    document.getElementById('resetCodeInfo').innerHTML = 'Sifirlama kodu <strong>' + maskedEmail + '</strong> adresine gonderildi.';
}

async function resendCode() {
    if (!pendingVerifyEmail) return;
    try {
        var res = await fetch('/api/auth/resend-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: pendingVerifyEmail })
        });
        var data = await res.json();
        if (res.ok) {
            showToast('Yeni dogrulama kodu gonderildi');
        } else {
            showToast(data.error || 'Kod gonderilemedi');
        }
    } catch (e) {
        showToast('Baglanti hatasi');
    }
}

// ========== Google ile Giris ==========
function loginWithGoogle() {
    var w = 500, h = 600;
    var left = (screen.width - w) / 2;
    var top = (screen.height - h) / 2;
    window.open('/api/auth/google/login', 'google-login', 'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top);
}

// Google popup'tan gelen mesaji dinle
window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'google-auth') {
        authToken = event.data.token;
        userId = event.data.user_id;
        currentUsername = event.data.username;
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('userId', userId);
        localStorage.setItem('username', currentUsername);
        document.getElementById('authModal').style.display = 'none';
        resetAuthForm();
        showToast('Google ile giris basarili!');
        updateProfileUI();
        loadSessions();
        loadTrashCount();
        updateMessageLimit();
    }
    if (event.data && event.data.error) {
        showToast(event.data.error);
    }
});

// Handle Enter key and password rules in auth inputs
document.addEventListener('DOMContentLoaded', function() {
    var authInputs = ['authPassword', 'authUsername', 'authPasswordConfirm', 'authVerifyCode', 'authEmail'];
    authInputs.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
            el.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') submitAuth();
            });
        }
    });
    var pwEl = document.getElementById('authPassword');
    var pw2El = document.getElementById('authPasswordConfirm');
    if (pwEl) pwEl.addEventListener('input', updatePasswordRules);
    if (pw2El) pw2El.addEventListener('input', updatePasswordRules);
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
    div.setAttribute('data-sid', s.session_id);
    if (s.session_id === sessionId) div.classList.add('active');

    // Checkbox (bulk mode icin)
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'session-checkbox';
    cb.style.display = bulkMode ? '' : 'none';
    cb.checked = selectedSessions.has(s.session_id);
    cb.onclick = function(e) { e.stopPropagation(); };
    cb.onchange = function() {
        if (cb.checked) {
            selectedSessions.add(s.session_id);
        } else {
            selectedSessions.delete(s.session_id);
        }
        updateBulkCount();
    };
    div.appendChild(cb);

    if (bulkMode) div.classList.add('bulk-mode');

    var titleSpan = document.createElement('span');
    titleSpan.className = 'session-title';
    titleSpan.textContent = s.title;
    titleSpan.onclick = function() {
        if (bulkMode) {
            cb.checked = !cb.checked;
            cb.onchange();
        } else {
            loadSession(s.session_id);
        }
    };
    div.appendChild(titleSpan);

    var menuBtn = document.createElement('button');
    menuBtn.className = 'session-menu-btn';
    menuBtn.textContent = '\u2026';
    menuBtn.style.display = bulkMode ? 'none' : '';
    menuBtn.onclick = function(e) { showSessionMenu(e, s.session_id, s.title); };
    div.appendChild(menuBtn);
    return div;
}

async function loadSessions() {
    try {
        // Load folders
        var foldersRes = await authFetch('/api/chat-folders');
        var folders = await foldersRes.json();

        // Load sessions
        var res = await authFetch('/api/sessions');
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
    var sessionItem = e.target.closest('.session-item');
    sessionItem.appendChild(menu);

    // Ekranin altina yakinsa menuyu yukari ac
    var menuRect = menu.getBoundingClientRect();
    if (menuRect.bottom > window.innerHeight - 20) {
        menu.style.top = 'auto';
        menu.style.bottom = '100%';
    }
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
    authFetch('/api/chat-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
    }).then(function() { loadSessions(); showToast('Klasor olusturuldu!'); });
}

async function deleteChatFolder(folderId) {
    try {
        await authFetch('/api/chat-folders/' + folderId, { method: 'DELETE' });
        showToast('Klasor silindi');
        loadSessions();
    } catch(e) { showToast('Silme hatasi'); }
}

async function showMoveToFolderModal(sid) {
    // Fetch folders
    var foldersRes = await authFetch('/api/chat-folders');
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
        await authFetch('/api/sessions/' + sid + '/move', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder_id: folderId })
        });
        showToast(folderId ? 'Sohbet klasore tasildi' : 'Sohbet klasorden cikarildi');
        loadSessions();
    } catch(e) { showToast('Tasima hatasi'); }
}

async function loadSession(sid, searchQuery) {
    sessionId = sid;
    closeRecipeViewer();
    closeProfilePanel();
    closeTrashPanel();
    document.getElementById('chatContainer').style.display = '';
    messagesEl.querySelectorAll('.message').forEach(function(m) { m.remove(); });
    if (welcomeEl) welcomeEl.style.display = 'none';
    try {
        var res = await authFetch('/api/sessions/' + sid + '/messages');
        var msgs = await res.json();
        msgs.forEach(function(m) { addMessage(m.content, m.role, null, true); });

        if (searchQuery) {
            // Aranan kelimeyi iceren mesaji bul ve vurgulayarak scroll yap
            highlightAndScrollToMatch(searchQuery);
        } else {
            scrollToBottom();
        }
    } catch(e) {}
    loadSessions();
    sidebarEl.classList.remove('open'); overlayEl.classList.remove('active');
}

function highlightAndScrollToMatch(query) {
    // Render tamamlansin diye kisa gecikme
    setTimeout(function() {
        var allMsgs = messagesEl.querySelectorAll('.message');
        var regex = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
        var found = false;

        for (var i = 0; i < allMsgs.length; i++) {
            var msg = allMsgs[i];
            var contentEl = msg.querySelector('.message-content') || msg.querySelector('span');
            if (!contentEl) continue;

            var text = contentEl.textContent || contentEl.innerText || '';
            if (text.toLowerCase().includes(query.toLowerCase())) {
                if (!found) {
                    // Kelimeyi vurgula
                    if (msg.querySelector('.message-content')) {
                        var html = msg.querySelector('.message-content').innerHTML;
                        msg.querySelector('.message-content').innerHTML = html.replace(regex, '<mark class="search-highlight" style="background:rgba(16,185,129,0.35);color:inherit;border-radius:3px;padding:1px 3px;">$1</mark>');
                    }
                    // Vurgulanan ilk mark etiketine scroll yap
                    var firstMark = msg.querySelector('.search-highlight');
                    if (firstMark) {
                        firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    } else {
                        msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                    // Parlama efekti
                    msg.style.outline = '2px solid rgba(16,185,129,0.6)';
                    msg.style.borderRadius = '12px';
                    setTimeout(function() { msg.style.outline = ''; }, 3000);
                    found = true;
                }
            }
        }
        if (!found) scrollToBottom();
    }, 200);
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
            authFetch('/api/sessions/' + sid + '/title', {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({title: newTitle})
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
        await authFetch('/api/sessions/' + sid, { method: 'DELETE' });
        if (sid === sessionId) newChat();
        loadSessions();
        loadTrashCount();
    } catch(e) {}
}

// ========== Toplu Sohbet Yonetimi ==========
var bulkMode = false;
var selectedSessions = new Set();

function enterBulkMode() {
    bulkMode = true;
    selectedSessions.clear();
    document.getElementById('bulkActions').style.display = '';
    document.getElementById('bulkModeBtn').style.display = 'none';
    document.getElementById('bulkSelectAll').checked = false;
    updateBulkCount();
    // Checkbox'lari goster, menu butonlarini gizle
    var items = document.querySelectorAll('#sessionList .session-item');
    items.forEach(function(item) {
        item.classList.add('bulk-mode');
        var cb = item.querySelector('.session-checkbox');
        if (cb) { cb.style.display = ''; cb.checked = false; }
        var menuBtn = item.querySelector('.session-menu-btn');
        if (menuBtn) menuBtn.style.display = 'none';
    });
}

function exitBulkMode() {
    bulkMode = false;
    selectedSessions.clear();
    document.getElementById('bulkActions').style.display = 'none';
    document.getElementById('bulkModeBtn').style.display = '';
    // Checkbox'lari gizle, menu butonlarini goster
    var items = document.querySelectorAll('#sessionList .session-item');
    items.forEach(function(item) {
        item.classList.remove('bulk-mode');
        var cb = item.querySelector('.session-checkbox');
        if (cb) { cb.style.display = 'none'; cb.checked = false; }
        var menuBtn = item.querySelector('.session-menu-btn');
        if (menuBtn) menuBtn.style.display = '';
    });
}

function toggleSelectAll() {
    var checked = document.getElementById('bulkSelectAll').checked;
    var items = document.querySelectorAll('#sessionList .session-checkbox');
    items.forEach(function(cb) {
        cb.checked = checked;
        var sid = cb.closest('.session-item').getAttribute('data-sid');
        if (checked) {
            selectedSessions.add(sid);
        } else {
            selectedSessions.delete(sid);
        }
    });
    updateBulkCount();
}

function updateBulkCount() {
    document.getElementById('bulkSelectedCount').textContent = selectedSessions.size + ' secili';
}

async function bulkDeleteSelected() {
    if (selectedSessions.size === 0) {
        showToast('Hicbir sohbet secilmedi');
        return;
    }
    confirmDelete(selectedSessions.size + ' sohbet silinecek. Emin misiniz?', async function() {
        try {
            await authFetch('/api/sessions/bulk-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_ids: Array.from(selectedSessions) })
            });
            showToast(selectedSessions.size + ' sohbet silindi');
            exitBulkMode();
            if (selectedSessions.has(sessionId)) newChat();
            loadSessions();
            loadTrashCount();
        } catch(e) {
            showToast('Silme hatasi');
        }
    });
}

async function clearAllSessions() {
    confirmDelete('TUM sohbetleriniz cop kutusuna tasinacak. Emin misiniz?', async function() {
        try {
            await authFetch('/api/sessions/clear-all', { method: 'DELETE' });
            showToast('Tum sohbetler temizlendi');
            newChat();
            loadSessions();
            loadTrashCount();
        } catch(e) {
            showToast('Temizleme hatasi');
        }
    });
}

// ========== Sohbet Arama ==========
var chatSearchTimeout = null;
function searchChats() {
    var q = document.getElementById('chatSearchInput').value.trim();
    var resultsEl = document.getElementById('chatSearchResults');
    var sessionListEl = document.getElementById('sessionList');

    if (q.length < 2) {
        resultsEl.style.display = 'none';
        sessionListEl.style.display = '';
        return;
    }

    clearTimeout(chatSearchTimeout);
    chatSearchTimeout = setTimeout(async function() {
        try {
            var res = await authFetch('/api/sessions/search?q=' + encodeURIComponent(q));
            var results = await res.json();
            resultsEl.innerHTML = '';
            sessionListEl.style.display = 'none';
            resultsEl.style.display = '';

            if (results.length === 0) {
                resultsEl.innerHTML = '<div class="empty-state">Sonuc bulunamadi</div>';
                return;
            }

            results.forEach(function(r) {
                var item = document.createElement('div');
                item.className = 'chat-search-item';
                item.onclick = function() {
                    var searchTerm = q;
                    loadSession(r.session_id, searchTerm);
                    document.getElementById('chatSearchInput').value = '';
                    resultsEl.style.display = 'none';
                    sessionListEl.style.display = '';
                };

                var titleDiv = document.createElement('div');
                titleDiv.className = 'chat-search-item-title';
                titleDiv.textContent = r.title;
                item.appendChild(titleDiv);

                var snippetDiv = document.createElement('div');
                snippetDiv.className = 'chat-search-item-snippet';
                // Aranan kelimeyi vurgula
                var escaped = DOMPurify.sanitize(r.snippet);
                var regex = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
                snippetDiv.innerHTML = escaped.replace(regex, '<mark>$1</mark>');
                item.appendChild(snippetDiv);

                resultsEl.appendChild(item);
            });
        } catch(e) {}
    }, 300);
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
        var res = await authFetch('/api/books-tree');
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
    await authFetch('/api/books/' + id, { method: 'DELETE' });
    showToast('Defter silindi');
    loadBookTree();
}

async function deleteFolder(id) {
    await authFetch('/api/folders/' + id, { method: 'DELETE' });
    showToast('Klasor silindi');
    loadBookTree();
}

function promptNewBook() {
    var name = prompt('Yeni defter adi:');
    if (!name) return;
    authFetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name })
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
            var res = await authFetch('/api/saved-recipes/search?q=' + encodeURIComponent(q));
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
                authFetch('/api/saved-recipes/' + recipeId + '/rate', {
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
        var res = await authFetch('/api/folders/' + folderId + '/recipes');
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
                    authFetch('/api/saved-recipes/' + r.id, { method: 'DELETE' }).then(function() {
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

            content.appendChild(card);
        });
    } catch(e) { content.innerHTML = '<p>Hata olustu.</p>'; }

    sidebarEl.classList.remove('open'); overlayEl.classList.remove('active');
}

// ========== Tarif Paylasimi ==========
async function shareRecipe(recipeId) {
    try {
        var res = await authFetch('/api/saved-recipes/' + recipeId + '/share', { method: 'POST' });
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
            var res = await authFetch('/api/saved-recipes/' + recipe.id, {
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
        var res = await authFetch('/api/auth/profile');
        var data = await res.json();
        document.getElementById('profileInfoUserId').textContent = data.user_id || '-';
        document.getElementById('profileInfoCreatedAt').textContent = data.created_at ? new Date(data.created_at).toLocaleDateString('tr-TR', {year:'numeric', month:'long', day:'numeric'}) : '-';
        document.getElementById('profileNewUsername').value = data.username || '';
        document.getElementById('profileFirstName').value = data.first_name || '';
        document.getElementById('profileLastName').value = data.last_name || '';
        document.getElementById('profileBirthDate').value = data.birth_date || '';
        document.getElementById('profileEmail').value = data.email || '';

        // E-posta dogrulama durumu
        var emailStatus = document.getElementById('profileEmailStatus');
        if (data.email && data.email_verified) {
            emailStatus.innerHTML = '<span style="color:#2ecc71;">\u2705 E-posta dogrulanmis</span>';
        } else if (data.email) {
            emailStatus.innerHTML = '<span style="color:#e74c3c;">\u274C E-posta dogrulanmamis</span>';
        } else {
            emailStatus.innerHTML = '';
        }
    } catch(e) {}

    document.getElementById('profileOldPassword').value = '';
    document.getElementById('profileNewPassword').value = '';
    // Hata mesajlarini temizle
    ['profileUsernameError', 'profilePasswordError', 'profilePersonalError', 'profileEmailError'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Close sidebar on mobile
    sidebarEl.classList.remove('open');
    overlayEl.classList.remove('active');
}

function closeProfilePanel() {
    document.getElementById('profilePanel').style.display = 'none';
    document.getElementById('chatContainer').style.display = '';
}

async function saveProfilePersonal() {
    var firstName = document.getElementById('profileFirstName').value.trim();
    var lastName = document.getElementById('profileLastName').value.trim();
    var birthDate = document.getElementById('profileBirthDate').value;
    var errEl = document.getElementById('profilePersonalError');

    if (!firstName || !lastName) {
        errEl.textContent = 'Isim ve soyisim zorunludur';
        errEl.style.display = 'block';
        return;
    }
    try {
        var res = await authFetch('/api/auth/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ first_name: firstName, last_name: lastName, birth_date: birthDate })
        });
        var data = await res.json();
        if (!res.ok) {
            errEl.textContent = data.error || 'Bir hata olustu';
            errEl.style.display = 'block';
            return;
        }
        errEl.style.display = 'none';
        showToast('Kisisel bilgiler guncellendi!');
    } catch(e) {
        errEl.textContent = 'Baglanti hatasi';
        errEl.style.display = 'block';
    }
}

async function saveProfileEmail() {
    var email = document.getElementById('profileEmail').value.trim();
    var errEl = document.getElementById('profileEmailError');

    if (!email || !email.includes('@')) {
        errEl.textContent = 'Gecerli bir e-posta adresi girin';
        errEl.style.display = 'block';
        return;
    }
    try {
        var res = await authFetch('/api/auth/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });
        var data = await res.json();
        if (!res.ok) {
            errEl.textContent = data.error || 'Bir hata olustu';
            errEl.style.display = 'block';
            return;
        }
        errEl.style.display = 'none';
        var emailStatus = document.getElementById('profileEmailStatus');
        if (data.email_verified) {
            emailStatus.innerHTML = '<span style="color:#2ecc71;">\u2705 E-posta dogrulanmis</span>';
            showToast('E-posta guncellendi!');
        } else {
            emailStatus.innerHTML = '<span style="color:#e67e22;">\u2709 Dogrulama kodu gonderildi</span>';
            showToast('Yeni e-posta adresine dogrulama kodu gonderildi');
        }
    } catch(e) {
        errEl.textContent = 'Baglanti hatasi';
        errEl.style.display = 'block';
    }
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
        var res = await authFetch('/api/auth/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: newUsername })
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
        var res = await authFetch('/api/auth/password', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ old_password: oldPw, new_password: newPw })
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
        var res = await authFetch('/api/trash');
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
        var res = await authFetch('/api/trash');
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
        await authFetch('/api/trash/' + sessionId + '/restore', { method: 'POST' });
        showToast('Sohbet geri yuklendi!');
        openTrashPanel();
        loadSessions();
        loadTrashCount();
    } catch(e) { showToast('Geri yukleme hatasi'); }
}

async function permanentDeleteSession(sessionId) {
    try {
        await authFetch('/api/trash/' + sessionId + '/permanent', { method: 'DELETE' });
        showToast('Sohbet kalici olarak silindi');
        openTrashPanel();
        loadTrashCount();
    } catch(e) { showToast('Silme hatasi'); }
}

async function emptyTrash() {
    confirmDelete('Cop kutusundaki tum sohbetler kalici olarak silinecek. Emin misiniz?', async function() {
        try {
            await authFetch('/api/trash/empty', { method: 'DELETE' });
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
    var res = await authFetch('/api/books-tree');
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
            await authFetch('/api/books', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: inp.value.trim() })
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
            await authFetch('/api/books/' + bookId + '/folders', {
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
        await authFetch('/api/folders/' + folderId + '/recipes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title, content: favContent, source_session: sessionId })
        });
    } else {
        // Klasor secilmediyse deftere direkt kaydet ("Genel" klasorune)
        await authFetch('/api/books/' + bookId + '/save-recipe', {
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

// ========== Mesaj Duzenle Butonu ==========
function createEditBtn(msgElement, text) {
    var btn = document.createElement('button');
    btn.className = 'edit-btn';
    btn.textContent = '\u270F\uFE0F';
    btn.title = 'Duzenle';
    btn.onclick = function() {
        // Bu mesajdan sonraki tum mesajlari bul
        var allMsgs = messagesEl.querySelectorAll('.message');
        var found = false;
        var toRemove = [];
        for (var i = 0; i < allMsgs.length; i++) {
            if (allMsgs[i] === msgElement) found = true;
            if (found) toRemove.push(allMsgs[i]);
        }
        // DOM'dan kaldir
        toRemove.forEach(function(el) { el.remove(); });
        // Veritabanindan sil
        if (sessionId && toRemove.length > 0) {
            authFetch('/api/sessions/' + sessionId + '/rewind?count=' + toRemove.length, { method: 'DELETE' });
        }
        // Metni input'a koy
        inputEl.value = text;
        inputEl.focus();
    };
    return btn;
}

// ========== Paylas Butonu ==========
function createShareBtn(text) {
    var btn = document.createElement('button');
    btn.className = 'share-btn';
    btn.textContent = '\uD83D\uDD17';
    btn.title = 'Paylas';
    btn.onclick = async function() {
        try {
            var res = await authFetch('/api/messages/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: text })
            });
            var data = await res.json();
            if (res.ok && data.share_url) {
                navigator.clipboard.writeText(data.share_url).then(function() {
                    showToast('Paylasim linki kopyalandi!');
                }).catch(function() {
                    prompt('Paylasim linki:', data.share_url);
                });
            } else {
                showToast('Paylasim linki olusturulamadi');
            }
        } catch(e) {
            showToast('Baglanti hatasi');
        }
    };
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

// ========== Tarif Yaniti mi Kontrol ==========
function isRecipeResponse(text) {
    var lower = text.toLowerCase();
    // Menu, oneri, liste gibi yanitlari disla
    var nonRecipePatterns = ['pazartesi', 'sali', 'çarşamba', 'carsamba', 'perşembe',
        'persembe', 'cuma', 'cumartesi', 'pazar', 'haftalik', 'haftalık',
        'menu', 'menü', 'gun ', 'gün '];
    var nonRecipeCount = 0;
    for (var i = 0; i < nonRecipePatterns.length; i++) {
        if (lower.includes(nonRecipePatterns[i])) nonRecipeCount++;
    }
    // 3+ gun ismi geciyorsa bu bir menu/liste yaniti
    if (nonRecipeCount >= 3) return false;

    // Tek bir tarifin detayli anlatimi mi kontrol et
    var recipeKeywords = ['malzeme', 'yapılış', 'yapilis', 'pişirme', 'pisirme',
        'püf nokta', 'puf nokta', 'hazırlık', 'hazirlik',
        'yemek kaşığı', 'yemek kasigi', 'su bardağı', 'su bardagi',
        'çay kaşığı', 'cay kasigi', 'dakika ', 'derecede',
        'fırınla', 'firinla', 'kavur', 'haşla', 'hasla', 'doğra', 'dogra'];
    var matchCount = 0;
    for (var i = 0; i < recipeKeywords.length; i++) {
        if (lower.includes(recipeKeywords[i])) matchCount++;
    }
    return matchCount >= 3;
}

// ========== Mesaj Limiti ==========
async function updateMessageLimit() {
    if (!userId) return;
    try {
        var res = await authFetch('/api/chat/limit');
        var data = await res.json();
        var bar = document.getElementById('messageLimitBar');
        var text = document.getElementById('messageLimitText');
        var remaining = data.remaining;

        bar.classList.add('visible');
        bar.classList.remove('warning', 'exhausted');

        var mins = data.minutes_until_next;
        var timeText = '';
        if (mins) {
            if (mins >= 60) {
                var h = Math.floor(mins / 60);
                var m = mins % 60;
                timeText = h + ' sa ' + (m > 0 ? m + ' dk' : '');
            } else {
                timeText = mins + ' dk';
            }
        }

        if (remaining <= 0) {
            text.textContent = 'Mesaj hakkiniz doldu. Sonraki hak: ' + timeText + ' sonra';
            bar.classList.add('exhausted');
            inputEl.disabled = true;
            sendBtn.disabled = true;
            inputEl.placeholder = 'Mesaj limitiniz doldu...';
        } else if (remaining < 20 && timeText) {
            text.textContent = 'Kalan: ' + remaining + '/20 \u00B7 Sonraki yenilenme: ' + timeText;
            if (remaining <= 5) bar.classList.add('warning');
            inputEl.disabled = false;
            sendBtn.disabled = false;
            inputEl.placeholder = 'Bir yemek tarifi sorun...';
        } else {
            text.textContent = 'Kalan mesaj hakki: ' + remaining + '/20';
            inputEl.disabled = false;
            sendBtn.disabled = false;
            inputEl.placeholder = 'Bir yemek tarifi sorun...';
        }
    } catch(e) {}
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
        var res = await authFetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message, session_id: sessionId })
        });

        // Limit asildiysa
        if (res.status === 429) {
            typingEl.classList.remove('active');
            var errData = await res.json();
            contentDiv.textContent = errData.error || 'Mesaj limitiniz doldu.';
            contentDiv.style.color = '#e74c3c';
            messagesEl.insertBefore(assistantDiv, typingEl);
            updateMessageLimit();
            sendBtn.disabled = false;
            return;
        }

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
                        btnWrap.appendChild(createShareBtn(fullText));
                        btnWrap.appendChild(createFavBtn(fullText));
                        assistantDiv.appendChild(btnWrap);

                        // Extra action buttons + referanslar sadece tarif yanitlarinda
                        if (isRecipeResponse(fullText)) {
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
                        }
                        // Cache badge indicator
                        if (data.cached) {
                            var cacheBadge = document.createElement('div');
                            cacheBadge.className = 'cache-badge';
                            cacheBadge.textContent = 'Onbellekten yuklendi';
                            assistantDiv.appendChild(cacheBadge);
                        }

                        loadSessions();
                        updateMessageLimit();
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
        btnWrap.appendChild(createShareBtn(text));
        btnWrap.appendChild(createFavBtn(text));
        div.appendChild(btnWrap);

        // Extra action buttons for history messages too
        var extraWrap = document.createElement('div');
        extraWrap.className = 'msg-extra-actions';
        extraWrap.appendChild(createDetailBtn(text));
        extraWrap.appendChild(createPortionBtn(text));
        div.appendChild(extraWrap);
    } else {
        var userContent = document.createElement('span');
        userContent.textContent = text;
        div.appendChild(userContent);
        var editBtn = createEditBtn(div, text);
        div.appendChild(editBtn);
    }
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
        var res = await authFetch('/api/shopping-lists/from-recipe', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({recipe_content: recipeContent})
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
        var res = await authFetch('/api/shopping-lists');
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
                    authFetch('/api/shopping-lists/' + list.id, { method: 'DELETE' }).then(function() {
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
        var res = await authFetch('/api/shopping-lists/' + listId);
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
    fetch('/api/auth/logout', { method: 'POST' }).catch(function() {});
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    authToken = null;
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
renderSuggestions();
if (authToken) {
    loadSessions();
    loadTrashCount();
    updateMessageLimit();
}
