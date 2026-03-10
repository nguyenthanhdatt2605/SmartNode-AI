// --- 1. FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyBqQAhZefoX7XX6NRjH3wSGXzPNM0dpN6c",
    authDomain: "j-b2103.firebaseapp.com",
    databaseURL: "https://j-b2103-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "j-b2103",
    storageBucket: "j-b2103.firebasestorage.app",
    messagingSenderId: "304185809232",
    appId: "1:304185809232:web:2363f4630e90fbb05a3455"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- 2. AUTH & TABS ---
function authLogin() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('pass').value;
    if (!email || !pass) return alert("Vui lòng điền đủ thông tin!");

    firebase.auth().signInWithEmailAndPassword(email, pass).then(() => {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-container').style.display = 'block'; // Block the container
        showTab('dashboard'); // Init tab
        startSync();
        initClockSystem();
    }).catch(e => alert("Lỗi đăng nhập: " + e.message));
}

function authLogout() { firebase.auth().signOut().then(() => location.reload()); }

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
}

// --- 3. CORE LOGIC (AUTO VS MANUAL) ---
function handleAutoMode() {
    const isAuto = document.getElementById('check-auto').checked;
    db.ref('Control/dieu_khien').set(isAuto);
}

function updateUIForAuto(isAuto) {
    const modeText = document.getElementById('mode-text');
    const modeDesc = document.getElementById('mode-desc');
    const brightnessSlider = document.getElementById('range-dosang');

    if (isAuto) {
        modeText.innerText = "CHẾ ĐỘ TỰ ĐỘNG";
        modeText.style.color = "#00f2ff";
        modeText.style.textShadow = "0 0 20px rgba(0,242,255,0.5)";
        modeDesc.innerText = "Hệ thống đang tự điều tiết bởi AI.";
        brightnessSlider.disabled = true;
    } else {
        modeText.innerText = "CHẾ ĐỘ THỦ CÔNG";
        modeText.style.color = "white";
        modeText.style.textShadow = "none";
        modeDesc.innerText = "Kéo thanh trượt để điều chỉnh độ sáng.";
        brightnessSlider.disabled = false;
    }
}

// --- 4. HỆ THỐNG THỜI GIAN & HẸN GIỜ ---
let masterClock;
function openTimer() { document.getElementById('timer-modal').style.display = 'flex'; }
function closeTimer() { document.getElementById('timer-modal').style.display = 'none'; }

function startTimerProcess() {
    const mins = document.getElementById('timer-input').value;
    if (!mins || mins <= 0) return alert("Vui lòng nhập số phút hợp lệ!");
    const deadline = Date.now() + (mins * 60 * 1000);
    db.ref('Control/timer_deadline').set(deadline).then(() => closeTimer());
}

function initClockSystem() {
    db.ref('Control/timer_deadline').on('value', snap => {
        const deadline = snap.val() || 0;
        const clockSpan = document.getElementById('mini-clock');
        const clockBox = document.querySelector('.clock-bg');

        if (masterClock) clearInterval(masterClock);

        masterClock = setInterval(() => {
            const now = Date.now();
            if (deadline > now) {
                // Đếm ngược
                const dist = deadline - now;
                const m = Math.floor(dist / 60000);
                const s = Math.floor((dist % 60000) / 1000);
                clockSpan.innerText = `${m}:${s.toString().padStart(2, '0')}`;
                clockSpan.style.color = "#ff4d4d";
                clockBox.style.borderColor = "#ff4d4d";
                clockBox.style.boxShadow = "0 0 15px rgba(255, 77, 77, 0.3)";
            } else {
                // Đồng hồ thực
                const d = new Date();
                clockSpan.innerText = d.getHours().toString().padStart(2, '0') + ":" + 
                                      d.getMinutes().toString().padStart(2, '0');
                clockSpan.style.color = "#00f2ff";
                clockBox.style.borderColor = "rgba(255,255,255,0.1)";
                clockBox.style.boxShadow = "none";

                // Hết giờ -> Tắt
                if (deadline !== 0 && (now - deadline) < 2000) {
                    db.ref('Control/timer_deadline').set(0);
                    db.ref('Control/dieu_khien').set(false);
                    db.ref('Control/do_sang').set(0);
                }
            }
        }, 1000);
    });
}

// --- 5. AI GIỌNG NÓI (HIỂU LỆNH & THỰC THI) ---
function startVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Trình duyệt không hỗ trợ AI giọng nói!");

    const rec = new SpeechRecognition();
    rec.lang = 'vi-VN';
    const btn = document.getElementById('btn-voice');

    rec.onstart = () => btn.classList.add('voice-active');
    
    rec.onresult = (e) => {
        const cmd = e.results[0][0].transcript.toLowerCase();
        console.log("AI nghe được lệnh: ", cmd);
        
        const autoSwitch = document.getElementById('check-auto');
        
        // Bật / Tắt tự động
        if (cmd.includes("tự động") || cmd.includes("a i")) {
            const isAutoOn = cmd.includes("bật") || cmd.includes("mở");
            autoSwitch.checked = isAutoOn;
            handleAutoMode();
        } 
        // Tắt đèn thủ công
        else if (cmd.includes("tắt đèn") || cmd.includes("tắt hệ thống")) {
            autoSwitch.checked = false;
            handleAutoMode();
            db.ref('Control/do_sang').set(0);
        }
        // Mở đèn (sáng 100%)
        else if (cmd.includes("bật đèn") || cmd.includes("mở đèn") || cmd.includes("sáng tối đa")) {
            autoSwitch.checked = false;
            handleAutoMode();
            db.ref('Control/do_sang').set(100);
        }
        // Chỉnh độ sáng (Ví dụ "Độ sáng 50", "Chỉnh 75 phần trăm")
        else if (cmd.includes("sáng") || cmd.includes("mức") || cmd.includes("độ")) {
            if (autoSwitch.checked) {
                alert("Hệ thống đang Tự động. Đã tắt để chỉnh độ sáng!");
                autoSwitch.checked = false;
                handleAutoMode();
            }
            const match = cmd.match(/\d+/);
            if (match) {
                let val = parseInt(match[0]);
                if (val > 100) val = 100;
                db.ref('Control/do_sang').set(val);
            }
        }
    };
    
    rec.onend = () => btn.classList.remove('voice-active');
    rec.start();
}

// --- 6. FIREBASE SYNC (REALTIME) ---
function startSync() {
    // Thông số từ Cảm biến
    db.ref('SmartNode_01/telemetry').on('value', snap => {
        const data = snap.val(); if(!data) return;
        
        document.getElementById('val-cur').innerText = data.e.cur.toFixed(4);
        document.getElementById('val-wh').innerText = data.e.E_Wh.toFixed(3);
        document.getElementById('val-vol').innerText = data.e.vol.toFixed(1) + "V";
        document.getElementById('val-power').innerText = data.e.power_W.toFixed(2) + "W";

        const rdr = data.radar;
        document.getElementById('val-static').innerText = rdr.static_cm;
        document.getElementById('val-moving').innerText = rdr.moving_cm;
        document.getElementById('bar-move').style.width = (rdr.moving_energy || 0) + "%";
        document.getElementById('txt-move-energy').innerText = (rdr.moving_energy || 0) + "%";
        
        const badge = document.getElementById('presence-badge');
        const scannerIcon = document.querySelector('.radar-scanner i');
        if (rdr.presence) {
            badge.innerText = "PHÁT HIỆN NGƯỜI";
            badge.style.color = "#00f2ff";
            scannerIcon.style.color = "#00f2ff";
            scannerIcon.style.filter = "drop-shadow(0 0 10px #00f2ff)";
        } else {
            badge.innerText = "PHÒNG TRỐNG";
            badge.style.color = "#666";
            scannerIcon.style.color = "#444";
            scannerIcon.style.filter = "none";
        }

        document.getElementById('val-lux').innerText = data.light_info.environment_lux;
        document.getElementById('val-lamp').innerText = data.light_info.lamp_percent + "%";
    });

    // Đồng bộ nút gạt Tự động
    db.ref('Control/dieu_khien').on('value', snap => {
        const isAuto = snap.val();
        document.getElementById('check-auto').checked = isAuto;
        updateUIForAuto(isAuto);
    });

    // Đồng bộ thanh kéo Độ sáng
    db.ref('Control/do_sang').on('value', snap => {
        const brightness = snap.val();
        document.getElementById('range-dosang').value = brightness;
        document.getElementById('txt-dosang').innerText = brightness;
    });
}

// Lắng nghe thanh kéo thủ công
document.getElementById('range-dosang').addEventListener('input', (e) => {
    const val = e.target.value;
    document.getElementById('txt-dosang').innerText = val;
    db.ref('Control/do_sang').set(parseInt(val));
});