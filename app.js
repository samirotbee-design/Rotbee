// ═══════════ سوپر اپلیکیشن جامع رتبه - منطق اصلی ═══════════

const App = {
  questions: [],
  currentSection: 'splash',
  currentExam: null,
  currentQuestionIndex: 0,
  deviceId: null,
  _examCats: {},
  _selectedSubject: null,
  _lastResult: null,

  // ─── راه‌اندازی ───
  async init() {
    this.deviceId = this.getOrCreateDeviceId();
    const devEl = document.getElementById('deviceIdDisplay');
    if (devEl) devEl.textContent = this.deviceId;

    // ۱. لود سوالات (اول از همه، چون در حالت آفلاین هم لازم است)
    try {
      const res = await fetch('questions.json', { cache: 'default' });
      const data = await res.json();
      this.questions = data.questions || [];
      console.log(`✅ ${this.questions.length} سوال لود شد`);
    } catch (e) {
      console.error('خطا در لود سوالات:', e);
    }

    // ۲. چک اگه کاربر قبلاً لاگین کرده (حتی آفلاین)
    const saved = localStorage.getItem('rotbee_user');
    if (saved) {
      const user = JSON.parse(saved);
      if (this.isSubscriptionValid(user)) {
        this.hideSplash();
        this.showSection('dashboard');
        return;
      }
    }

    // ۳. اگه لاگین نکرده، اینترنت رو چک کن
    if (!navigator.onLine) {
      this.showNoInternet();
      return;
    }

    // ۴. چک آپدیت
    const hasUpdate = await this.checkUpdate();
    if (hasUpdate) return;

    this.hideSplash();
    this.showSection('login');
  },

  hideSplash() {
    const s = document.getElementById('splash');
    if (s) s.style.display = 'none';
  },

  // ─── Device ID ───
  getOrCreateDeviceId() {
    let id = localStorage.getItem('rotbee_device_id');
    if (!id || id.length !== 8) {
      id = '';
      const chars = '0123456789ABCDEF';
      for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * 16)];
      localStorage.setItem('rotbee_device_id', id);
    }
    return id;
  },

  copyDeviceId() {
    this.copyToClipboard(this.deviceId);
  },

  // ─── لاگین ───
  login() {
    const code = document.getElementById('loginCode').value.trim().toUpperCase();
    const errorEl = document.getElementById('loginError');
    errorEl.style.display = 'none';

    if (!code) {
      errorEl.textContent = 'لطفاً کد اشتراک را وارد کنید.';
      errorEl.style.display = 'block';
      return;
    }

    const parts = code.split('-');
    if (parts.length !== 5 || parts[0] !== 'RTB') {
      errorEl.textContent = 'فرمت کد اشتراک نامعتبر است. (مثال: RTB-V-90-A1B2-C3D4)';
      errorEl.style.display = 'block';
      return;
    }

    const [_, plan, days, first4, last4] = parts;
    const deviceFirst4 = this.deviceId.substring(0, 4);
    const deviceLast4 = this.deviceId.substring(4, 8);

    if (first4 !== deviceFirst4 || last4 !== deviceLast4) {
      errorEl.textContent = 'کد اشتراک برای این دستگاه صادر نشده است.';
      errorEl.style.display = 'block';
      return;
    }

    if (!['N', 'V', 'S'].includes(plan)) {
      errorEl.textContent = 'نوع اشتراک نامعتبر است.';
      errorEl.style.display = 'block';
      return;
    }

    const daysNum = parseInt(days);
    if (isNaN(daysNum) || daysNum <= 0 || daysNum > 3650) {
      errorEl.textContent = 'مدت زمان نامعتبر است.';
      errorEl.style.display = 'block';
      return;
    }

    const expiry = Date.now() + daysNum * 24 * 60 * 60 * 1000;
    const user = { deviceId: this.deviceId, plan, expiry };
    localStorage.setItem('rotbee_user', JSON.stringify(user));

    this.toast('✅ اشتراک فعال شد');
    this.showSection('dashboard');
  },

  getUser() {
    const s = localStorage.getItem('rotbee_user');
    return s ? JSON.parse(s) : null;
  },

  isSubscriptionValid(user) {
    return user && user.expiry > Date.now();
  },

  getDaysRemaining(user) {
    if (!user) return 0;
    return Math.max(0, Math.ceil((user.expiry - Date.now()) / (24 * 60 * 60 * 1000)));
  },

  logout() {
    if (confirm('آیا از حساب خود خارج می‌شوید؟')) {
      localStorage.removeItem('rotbee_user');
      this.showSection('login');
    }
  },

  // ─── ناوبری ───
  showSection(name) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(name + 'Section');
    if (el) el.classList.add('active');
    this.currentSection = name;

    if (name === 'dashboard') this.updateDashboard();
    if (name === 'exam') this.loadExamCategories();
    if (name === 'wrong') this.loadWrongAnswers();
    if (name === 'chat') this.initChat();
    window.scrollTo(0, 0);
  },

  goTo(name) {
    this.showSection(name);
  },

  // ─── داشبورد ───
  updateDashboard() {
    const user = this.getUser();
    if (!user) return;

    const planNames = { N: 'عادی', V: 'VIP', S: 'ویژه رتبه' };
    document.getElementById('planBadge').textContent = 'اشتراک: ' + (planNames[user.plan] || '---');
    document.getElementById('daysBadge').textContent = this.getDaysRemaining(user) + ' روز';

    document.getElementById('statStreak').textContent = this.getStreak();

    const attempts = JSON.parse(localStorage.getItem('rotbee_attempts') || '[]');
    document.getElementById('statAttempts').textContent = attempts.length;

    if (attempts.length > 0) {
      let correct = 0, total = 0;
      attempts.forEach(a => { correct += a.score; total += a.total; });
      const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
      document.getElementById('statProgress').textContent = pct + '%';
    }
  },

  getStreak() {
    const today = new Date().toDateString();
    const lastVisit = localStorage.getItem('rotbee_last_visit');
    let streak = parseInt(localStorage.getItem('rotbee_streak') || '0');

    if (lastVisit === today) return streak;

    if (lastVisit) {
      const last = new Date(lastVisit);
      const diff = Math.floor((new Date() - last) / (24 * 60 * 60 * 1000));
      streak = diff === 1 ? streak + 1 : 1;
    } else {
      streak = 1;
    }

    localStorage.setItem('rotbee_streak', streak);
    localStorage.setItem('rotbee_last_visit', today);
    return streak;
  },

  // ─── آزمون ───
  loadExamCategories() {
    const cats = {};
    this.questions.forEach(q => {
      const c = q.category || 'سایر';
      if (!cats[c]) cats[c] = [];
      if (!cats[c].includes(q.subject)) cats[c].push(q.subject);
    });
    this._examCats = cats;

    const el = document.getElementById('examCategories');
    el.innerHTML = '<h3 style="margin-bottom:12px;font-size:15px;">دسته را انتخاب کنید:</h3><div id="catChips"></div>';
    const chips = document.getElementById('catChips');
    Object.keys(cats).sort().forEach(c => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = c;
      chip.onclick = () => this.selectCategory(c, chip);
      chips.appendChild(chip);
    });

    document.getElementById('examSubjects').classList.add('hidden');
    document.getElementById('startExamBtn').classList.add('hidden');
  },

  selectCategory(cat, chip) {
    document.querySelectorAll('#catChips .chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');

    const subs = this._examCats[cat] || [];
    const subEl = document.getElementById('examSubjects');
    subEl.classList.remove('hidden');
    subEl.innerHTML = '<h3 style="margin:16px 0 12px;font-size:15px;">درس را انتخاب کنید:</h3><div id="subChips"></div>';
    const subChips = document.getElementById('subChips');

    subs.forEach(s => {
      const count = this.questions.filter(q => q.subject === s).length;
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = `${s} (${count})`;
      chip.onclick = () => {
        document.querySelectorAll('#subChips .chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        this._selectedSubject = s;
        document.getElementById('startExamBtn').classList.remove('hidden');
      };
      subChips.appendChild(chip);
    });

    this._selectedSubject = null;
    document.getElementById('startExamBtn').classList.add('hidden');
  },

  startExam() {
    if (!this._selectedSubject) return;
    const qs = this.questions.filter(q => q.subject === this._selectedSubject);
    qs.sort(() => Math.random() - 0.5);
    this.currentExam = {
      questions: qs.slice(0, 10),
      subject: this._selectedSubject,
      answers: {}
    };
    this.currentQuestionIndex = 0;
    this.showSection('quiz');
    this.renderQuestion();
  },

  renderQuestion() {
    const exam = this.currentExam;
    const q = exam.questions[this.currentQuestionIndex];
    document.getElementById('quizCounter').textContent = `سوال ${this.currentQuestionIndex + 1} از ${exam.questions.length}`;
    document.getElementById('quizProgress').style.width = `${((this.currentQuestionIndex + 1) / exam.questions.length) * 100}%`;
    document.getElementById('quizQuestion').textContent = q.questionText;

    const opts = document.getElementById('quizOptions');
    opts.innerHTML = '';
    const options = [
      { k: 'A', text: q.optionA },
      { k: 'B', text: q.optionB },
      { k: 'C', text: q.optionC },
      { k: 'D', text: q.optionD }
    ];
    const selected = exam.answers[this.currentQuestionIndex];
    options.forEach(o => {
      const div = document.createElement('div');
      div.className = 'option' + (selected === o.k ? ' selected' : '');
      div.innerHTML = `<div class="option-num">${o.k}</div><div class="option-text">${o.text}</div>`;
      div.onclick = () => {
        exam.answers[this.currentQuestionIndex] = o.k;
        this.renderQuestion();
      };
      opts.appendChild(div);
    });

    document.getElementById('prevBtn').disabled = this.currentQuestionIndex === 0;
    document.getElementById('nextBtn').textContent = this.currentQuestionIndex === exam.questions.length - 1 ? 'پایان' : 'بعدی';
  },

  prevQuestion() {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
      this.renderQuestion();
    }
  },

  nextQuestion() {
    const exam = this.currentExam;
    if (this.currentQuestionIndex < exam.questions.length - 1) {
      this.currentQuestionIndex++;
      this.renderQuestion();
    } else {
      this.finishExam();
    }
  },

  finishExam() {
    const exam = this.currentExam;
    let score = 0;
    const wrong = [];
    exam.questions.forEach((q, i) => {
      if (exam.answers[i] === q.correctOption) score++;
      else wrong.push(q);
    });

    const attempts = JSON.parse(localStorage.getItem('rotbee_attempts') || '[]');
    attempts.push({ subject: exam.subject, score, total: exam.questions.length, date: Date.now() });
    localStorage.setItem('rotbee_attempts', JSON.stringify(attempts));

    if (wrong.length > 0) {
      const existing = JSON.parse(localStorage.getItem('rotbee_wrong') || '[]');
      wrong.forEach(q => {
        if (!existing.some(e => e.questionText === q.questionText)) existing.push(q);
      });
      localStorage.setItem('rotbee_wrong', JSON.stringify(existing));
    }

    this._lastResult = { exam, score, wrong };
    this.showSection('result');
    this.renderResult();
  },

  renderResult() {
    const { exam, score, wrong } = this._lastResult;
    document.getElementById('resultScore').textContent = `${score} از ${exam.questions.length}`;
    document.getElementById('resultMessage').textContent = score / exam.questions.length >= 0.6 ? '🎉 عالی بود!' : '💪 دفعه بعد بهتر می‌شی!';

    const details = document.getElementById('resultDetails');
    details.innerHTML = '';
    exam.questions.forEach((q, i) => {
      const userAns = exam.answers[i];
      const correct = userAns === q.correctOption;
      const div = document.createElement('div');
      div.className = 'result-card ' + (correct ? 'result-correct' : 'result-wrong');
      const correctText = q.correctOption === 'A' ? q.optionA : q.correctOption === 'B' ? q.optionB : q.correctOption === 'C' ? q.optionC : q.optionD;
      div.innerHTML = `
        <p style="font-size:14px;font-weight:bold;margin-bottom:8px;">${q.questionText}</p>
        <p style="font-size:12px;color:var(--success);">✅ پاسخ صحیح: ${q.correctOption}) ${correctText}</p>
        ${!correct ? `<p style="font-size:12px;color:var(--danger);">❌ پاسخ شما: ${userAns || 'بی‌پاسخ'}</p>` : ''}
        <div class="result-explanation">💡 ${q.explanation || 'توضیحی ثبت نشده است.'}</div>
      `;
      details.appendChild(div);
    });
  },

  // ─── دفتر اشتباهات ───
  loadWrongAnswers() {
    const wrong = JSON.parse(localStorage.getItem('rotbee_wrong') || '[]');
    const el = document.getElementById('wrongList');
    if (wrong.length === 0) {
      el.innerHTML = '<div class="glass-card" style="text-align:center;padding:40px;"><p style="font-size:18px;">🎉 هنوز سوال غلطی نداری!</p></div>';
      return;
    }
    el.innerHTML = '';
    wrong.forEach(q => {
      const div = document.createElement('div');
      div.className = 'card';
      const correctText = q.correctOption === 'A' ? q.optionA : q.correctOption === 'B' ? q.optionB : q.correctOption === 'C' ? q.optionC : q.optionD;
      div.innerHTML = `
        <p style="font-size:14px;font-weight:bold;margin-bottom:8px;">${q.questionText}</p>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">درس: ${q.subject}</p>
        <p style="font-size:12px;color:var(--success);">✅ ${q.correctOption}) ${correctText}</p>
        <div class="result-explanation">💡 ${q.explanation || 'توضیحی ثبت نشده است.'}</div>
      `;
      el.appendChild(div);
    });
  },

  // ─── چت ───
  initChat() {
    const el = document.getElementById('chatMessages');
    if (el.children.length > 0) return;
    this.addChatMessage('bot', 'سلام! من دستیار هوشمند Rotbee هستم. 🤖\nیک کلمه کلیدی (مثل «خیار» یا «برات») بفرست تا در ۹۳۹ سوال بگردم.');
  },

  addChatMessage(role, text) {
    const el = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = 'chat-msg chat-' + (role === 'user' ? 'user' : 'bot');
    div.style.whiteSpace = 'pre-line';
    div.textContent = text;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  },

  sendChat() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;
    this.addChatMessage('user', text);
    input.value = '';

    const botEl = document.createElement('div');
    botEl.className = 'chat-msg chat-bot';
    botEl.textContent = 'در حال جستجو...';
    document.getElementById('chatMessages').appendChild(botEl);
    document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;

    setTimeout(() => {
      botEl.textContent = this.searchBot(text);
      document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;
    }, 300);
  },

  searchBot(query) {
    const clean = query.replace(/[؟?]/g, '').trim();
    const words = clean.split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return 'لطفاً کلمه کلیدی معتبر وارد کنید.';

    let bestMatch = null;
    let bestScore = 0;

    this.questions.forEach(q => {
      let score = 0;
      words.forEach(w => {
        if (q.questionText.includes(w)) score += 10;
        if (q.subject && q.subject.includes(w)) score += 5;
        if (q.category && q.category.includes(w)) score += 5;
        if (q.explanation && q.explanation.includes(w)) score += 2;
      });
      if (score > bestScore) { bestScore = score; bestMatch = q; }
    });

    if (bestMatch && bestScore >= 10) {
      return `🤖 سوال مرتبط:\n\n${bestMatch.questionText}\n\n💡 پاسخ: ${bestMatch.explanation || 'بدون توضیح'}`;
    }
    return '🤖 سوالی مرتبط با کلمات کلیدی شما پیدا نکردم.';
  },

  // ─── راهنما ───
  showHelp(key) {
    const helps = {
      dashboard: {
        title: 'راهنمای داشبورد',
        text: 'در این صفحه آمار شما نمایش داده می‌شود:\n\n🔥 استریک: روزهای متوالی که وارد اپ شده‌اید\n🎯 پیشرفت: درصد پاسخ‌های صحیح\n🏆 آزمون‌ها: تعداد آزمون‌های داده شده\n\nاز دکمه‌های زیر به بخش‌های مختلف بروید.'
      },
      exam: {
        title: 'راهنمای آزمون',
        text: '۱. ابتدا یک دسته (مثل حقوق مدنی) انتخاب کنید.\n۲. سپس یک درس (مثل بیع) انتخاب کنید.\n۳. دکمه «شروع آزمون» را بزنید.\n\n۱۰ سوال تصادفی از آن درس نمایش داده می‌شود.'
      },
      quiz: {
        title: 'داخل آزمون',
        text: 'با انتخاب یکی از گزینه‌ها، پاسخ شما ثبت می‌شود.\nبا دکمه‌های «قبلی» و «بعدی» بین سوالات جابجا شوید.\nدر سوال آخر، دکمه «پایان» را بزنید.'
      },
      result: {
        title: 'راهنمای کارنامه',
        text: 'نمره شما در بالای صفحه نمایش داده می‌شود.\nدر پایین، هر سوال با پاسخ صحیح (سبز) و پاسخ شما (قرمز) و توضیح تشریحی نمایش داده می‌شود.'
      },
      wrong: {
        title: 'راهنمای دفتر اشتباهات',
        text: 'تمام سوالاتی که در آزمون‌ها غلط زده‌اید، به صورت خودکار در این بخش ذخیره می‌شوند.\nبا مرور آن‌ها، از اشتباهات خود درس بگیرید.'
      },
      chat: {
        title: 'راهنمای دستیار هوشمند',
        text: 'این ربات در بانک ۹۳۹ سوالی جستجو می‌کند.\nیک کلمه کلیدی واضح (مثل «خیار» یا «برات») بنویسید.\nنیازی به اینترنت ندارد و کاملاً آفلاین کار می‌کند.'
      },
      about: {
        title: 'راهنمای درباره ما',
        text: 'در این صفحه اطلاعات شرکای تجاری، شماره‌های پشتیبانی و توضیحات نرم‌افزار نمایش داده می‌شود.'
      }
    };

    const h = helps[key] || { title: 'راهنما', text: '' };
    document.getElementById('helpTitle').textContent = h.title;
    document.getElementById('helpText').style.whiteSpace = 'pre-line';
    document.getElementById('helpText').textContent = h.text;
    document.getElementById('helpModal').classList.remove('hidden');
  },

  closeHelp() {
    document.getElementById('helpModal').classList.add('hidden');
  },

  // ─── آپدیت ───
  async checkUpdate() {
    try {
      const res = await fetch('https://raw.githubusercontent.com/samirotbee-design/Rotbee/main/version.json', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.latest_version && data.latest_version !== '2.0.0') {
          document.getElementById('updateMessage').textContent = data.update_message || 'لطفاً نسخه جدید را نصب کنید.';
          document.getElementById('updateModal').classList.remove('hidden');
          return true;
        }
      }
    } catch (e) {}
    return false;
  },

  openUpdateLink() {
    window.open('https://rubika.ir/joinc/your_channel_link', '_blank');
  },

  // ─── اینترنت ───
  showNoInternet() {
    document.getElementById('noInternetModal').classList.remove('hidden');
    this.hideSplash();
  },

  // ─── ابزارها ───
  copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => this.toast('📋 کپی شد')).catch(() => this._fallbackCopy(text));
    } else {
      this._fallbackCopy(text);
    }
  },

  _fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); this.toast('📋 کپی شد'); } catch(e) { this.toast('❌ کپی نشد'); }
    document.body.removeChild(ta);
  },

  toast(msg) {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;bottom:20px;left:20px;right:20px;background:#1E293B;color:white;padding:14px;border-radius:12px;text-align:center;z-index:99999;border:1px solid #06B6D4;font-family:inherit;box-shadow:0 4px 20px rgba(0,0,0,0.5);';
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 2000);
  }
};

// راه‌اندازی روی لود
window.addEventListener('load', () => App.init());

// مدیریت وضعیت اینترنت
window.addEventListener('online', () => {
  const modal = document.getElementById('noInternetModal');
  if (modal && !modal.classList.contains('hidden')) {
    location.reload();
  }
});
window.addEventListener('offline', () => {
  if (App.currentSection !== 'dashboard' && App.currentSection !== 'quiz') {
    App.showNoInternet();
  }
});
