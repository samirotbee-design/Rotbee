// ═══════════ پنل مدیریت Rotbee - منطق ═══════════

const ADMIN_USERNAME = 'Kamran.K2K';

const Admin = {
  _selectedPlan: 'N',
  _selectedDays: 30,
  _generatedCode: '',

  init() {
    // اگه قبلاً لاگین کرده بود
    if (localStorage.getItem('rotbee_admin_logged') === 'true') {
      this.showDashboard();
    }
    // تنظیم متن دکمه رمز عبور
    this.updatePassLabel();
  },

  updatePassLabel() {
    const label = document.getElementById('passLabel');
    const hasPass = localStorage.getItem('rotbee_admin_pass');
    if (hasPass) {
      label.textContent = 'رمز عبور';
    } else {
      label.textContent = 'رمز عبور جدید (اولین بار تنظیم می‌شود)';
    }
  },

  login() {
    const user = document.getElementById('adminUser').value.trim();
    const pass = document.getElementById('adminPass').value;
    const errEl = document.getElementById('adminLoginError');
    errEl.style.display = 'none';

    if (user !== ADMIN_USERNAME) {
      errEl.textContent = 'نام کاربری نامعتبر است.';
      errEl.style.display = 'block';
      return;
    }

    if (!pass || pass.length < 4) {
      errEl.textContent = 'رمز عبور باید حداقل ۴ کاراکتر باشد.';
      errEl.style.display = 'block';
      return;
    }

    const saved = localStorage.getItem('rotbee_admin_pass');

    if (!saved) {
      // اولین بار: ذخیره رمز
      localStorage.setItem('rotbee_admin_pass', pass);
      localStorage.setItem('rotbee_admin_logged', 'true');
      this.showDashboard();
    } else {
      // دفعات بعد: چک رمز
      if (pass === saved) {
        localStorage.setItem('rotbee_admin_logged', 'true');
        this.showDashboard();
      } else {
        errEl.textContent = 'رمز عبور اشتباه است.';
        errEl.style.display = 'block';
      }
    }
  },

  showDashboard() {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById('dashboardAdminSection').classList.add('active');
    this.updatePassLabel();
  },

  logout() {
    if (confirm('از پنل ادمین خارج می‌شوید؟')) {
      localStorage.removeItem('rotbee_admin_logged');
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.getElementById('loginAdminSection').classList.add('active');
    }
  },

  selectPlan(plan, chip) {
    document.querySelectorAll('#planChips .chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
    this._selectedPlan = plan;
  },

  selectDays(days, chip) {
    document.querySelectorAll('#daysChips .chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
    this._selectedDays = days;
  },

  generateCode() {
    const deviceId = document.getElementById('genDeviceId').value.trim().toUpperCase();
    const errEl = document.getElementById('genError');
    const codeBox = document.getElementById('generatedCodeBox');
    errEl.style.display = 'none';
    codeBox.classList.add('hidden');

    if (deviceId.length !== 8) {
      errEl.textContent = 'Device ID باید دقیقاً ۸ کاراکتر باشد.';
      errEl.style.display = 'block';
      return;
    }

    if (!/^[A-F0-9]{8}$/.test(deviceId)) {
      errEl.textContent = 'Device ID باید فقط شامل حروف A-F و اعداد 0-9 باشد.';
      errEl.style.display = 'block';
      return;
    }

    const first4 = deviceId.substring(0, 4);
    const last4 = deviceId.substring(4, 8);
    this._generatedCode = `RTB-${this._selectedPlan}-${this._selectedDays}-${first4}-${last4}`;

    document.getElementById('generatedCodeValue').textContent = this._generatedCode;
    codeBox.classList.remove('hidden');
    codeBox.scrollIntoView({ behavior: 'smooth' });
  },

  copyGeneratedCode() {
    navigator.clipboard.writeText(this._generatedCode).then(() => {
      this.toast('📋 کد اشتراک کپی شد');
    });
  },

  showHelp() {
    document.getElementById('helpTitleAdmin').textContent = 'راهنمای پنل ادمین';
    document.getElementById('helpTextAdmin').style.whiteSpace = 'pre-line';
    document.getElementById('helpTextAdmin').textContent =
      '۱. کاربر اپ را باز می‌کند و Device ID (۸ کاراکتر) را برای شما می‌فرستد.\n' +
      '۲. شما Device ID را وارد کنید.\n' +
      '۳. نوع اشتراک (عادی/VIP/ویژه) و مدت (۳۰/۹۰/۱۸۰/۳۶۰ روز) را انتخاب کنید.\n' +
      '۴. دکمه «تولید کد» را بزنید.\n' +
      '۵. کد ساخته شده را با پیامک/روبیکا برای کاربر بفرستید.\n' +
      '۶. کاربر کد را وارد می‌کند و اپ برایش فعال می‌شود.\n\n' +
      '⚠️ نکته: کد فقط روی همان دستگاه (Device ID) کار می‌کند.';
    document.getElementById('helpModalAdmin').classList.remove('hidden');
  },

  toast(msg) {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;bottom:20px;left:20px;right:20px;background:#1E293B;color:white;padding:14px;border-radius:12px;text-align:center;z-index:99999;border:1px solid #06B6D4;font-family:inherit;box-shadow:0 4px 20px rgba(0,0,0,0.5);';
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 2000);
  }
};

// راه‌اندازی
window.addEventListener('load', () => Admin.init());
