(() => {
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav');
  const navLinks = [...document.querySelectorAll('.nav a[href^="#"]')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const closeMenu = () => {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'فتح القائمة');
  };

  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'إغلاق القائمة' : 'فتح القائمة');
    nav.classList.toggle('open', open);
  });

  navLinks.forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMenu();
  });

  document.addEventListener('click', e => {
    if (window.innerWidth <= 700 && nav.classList.contains('open') &&
        !nav.contains(e.target) && !toggle.contains(e.target)) closeMenu();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 700) closeMenu();
  });

  const updateHeader = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 12);
  };

  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  document.getElementById('year').textContent = new Date().getFullYear();

  // Section reveal animations
  const revealTargets = document.querySelectorAll(
    '.section-kicker,.intro-grid,.section-heading,.initiative-card,.impact-inner,.join-layout,.donate-panel,.closing'
  );

  revealTargets.forEach(el => el.classList.add('reveal'));

  if (!reducedMotion && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -35px 0px' });

    revealTargets.forEach(el => revealObserver.observe(el));
  } else {
    revealTargets.forEach(el => el.classList.add('is-visible'));
  }

  // Highlight current navigation section
  const sections = [...document.querySelectorAll('main section[id]')];

  if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        navLinks.forEach(link => {
          const active = link.getAttribute('href') === `#${entry.target.id}`;
          link.classList.toggle('active', active);

          if (active) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-35% 0px -55% 0px' });

    sections.forEach(section => sectionObserver.observe(section));
  }

  // Join form validation
  const form = document.getElementById('applicationForm');
  const status = document.getElementById('formStatus');

  form.addEventListener('submit', event => {
    event.preventDefault();

    const requiredFields = [...form.querySelectorAll('[required]')];
    let firstInvalid = null;

    requiredFields.forEach(field => {
      const invalid = !field.value.trim() || !field.checkValidity();
      field.setAttribute('aria-invalid', String(invalid));

      if (invalid && !firstInvalid) firstInvalid = field;
    });

    if (firstInvalid) {
      status.textContent = 'تأكد من تعبئة الحقول المطلوبة بشكل صحيح قبل المتابعة.';
      status.className = 'form-status form-error';
      firstInvalid.focus();
      return;
    }

    status.textContent = 'اكتمل فحص البيانات على جهازك، لكن لم يتم إرسال الطلب. يلزم ربط النموذج بخدمة استقبال آمنة حتى يصل إلى إدارة الفريق.';
    status.className = 'form-status form-success';
  });

  form.querySelectorAll('input,select').forEach(field => {
    field.addEventListener('input', () => field.removeAttribute('aria-invalid'));
    field.addEventListener('change', () => field.removeAttribute('aria-invalid'));
  });

  // Supabase authentication
  const loginModal = document.getElementById('loginModal');
  const openLogin = document.getElementById('openLogin');
  const closeLogin = document.getElementById('closeLogin');
  const loginForm = document.getElementById('loginForm');
  const loginStatus = document.getElementById('loginStatus');
  const adminArea = document.getElementById('adminArea');

  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  const otpWrap = document.getElementById('mfaOtpWrap');
  const otpInput = document.getElementById('mfaOtp');

  const mfaSetupWrap = document.getElementById('mfaSetupWrap');
  const mfaQr = document.getElementById('mfaQr');
  const mfaSecret = document.getElementById('mfaSecret');

  const config = window.ATHAR_SUPABASE_CONFIG || {};
  const configured =
    config.url &&
    config.anonKey &&
    !config.url.includes('YOUR_') &&
    !config.anonKey.includes('YOUR_');

  let authClient = null;
  let pendingMfa = null;

  if (configured && window.supabase?.createClient) {
    authClient = window.supabase.createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }

  const showLogin = (focusEmail = true) => {
    loginModal.hidden = false;
    document.body.style.overflow = 'hidden';

    if (focusEmail) {
      setTimeout(() => loginEmail.focus(), 30);
    }
  };

  const hideLogin = () => {
    loginModal.hidden = true;
    document.body.style.overflow = '';
  };

  const setAuthMessage = (message, kind = '') => {
    loginStatus.textContent = message;
    loginStatus.className = `auth-status ${kind}`.trim();
  };

  const resetMfaInterface = () => {
    pendingMfa = null;

    otpWrap.hidden = true;
    otpInput.required = false;
    otpInput.value = '';

    mfaSetupWrap.hidden = true;
    mfaQr.removeAttribute('src');
    mfaSecret.textContent = '';

    loginEmail.required = true;
    loginPassword.required = true;
  };

  const prepareMfaInterface = () => {
    loginEmail.required = false;
    loginPassword.required = false;

    otpWrap.hidden = false;
    otpInput.required = true;
    otpInput.value = '';
    otpInput.focus();
  };

  openLogin?.addEventListener('click', () => showLogin());
  closeLogin?.addEventListener('click', hideLogin);

  loginModal?.addEventListener('click', e => {
    if (e.target === loginModal) hideLogin();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && loginModal && !loginModal.hidden) {
      hideLogin();
    }
  });

  document.getElementById('togglePassword')?.addEventListener('click', e => {
    const visible = loginPassword.type === 'text';

    loginPassword.type = visible ? 'password' : 'text';
    e.currentTarget.textContent = visible ? 'إظهار' : 'إخفاء';
    e.currentTarget.setAttribute(
      'aria-label',
      visible ? 'إظهار كلمة المرور' : 'إخفاء كلمة المرور'
    );
  });

  const roleLabel = role => ({
    super_admin: 'الأدمن الرئيسي',
    moderator: 'مشرف',
    member: 'عضو'
  }[role] || 'عضو');

  // Display the correct dashboard according to trusted app_metadata
  const showDashboard = async user => {
    const role = user?.app_metadata?.role || 'member';

    if (!['super_admin', 'moderator', 'member'].includes(role)) {
      await authClient.auth.signOut();
      setAuthMessage('تعذر التحقق من صلاحية الحساب.', 'error');
      return;
    }

    if (role === 'super_admin') {
      const { data: isRoot, error } = await authClient.rpc('is_athar_super_admin');

      if (error || isRoot !== true) {
        await authClient.auth.signOut();
        setAuthMessage('تعذر إثبات هوية الأدمن الرئيسي. راجع إعدادات النظام.', 'error');
        return;
      }
    }

    if (role === 'moderator') {
      const { data: isStaff, error } = await authClient.rpc('is_athar_staff');

      if (error || isStaff !== true) {
        await authClient.auth.signOut();
        setAuthMessage('تعذر التحقق من صلاحية المشرف.', 'error');
        return;
      }
    }

    document.getElementById('adminEmail').textContent = user.email || '';
    document.getElementById('roleBadge').textContent = roleLabel(role);

    document.getElementById('dashboardTitle').textContent =
      role === 'member' ? 'مساحة العضو' : 'لوحة التحكم';

    document.getElementById('dashboardIntro').textContent =
      role === 'super_admin'
        ? 'لديك صلاحيات الإدارة الرئيسية لفريق أثر.'
        : role === 'moderator'
          ? 'لديك صلاحيات إشراف محددة وفق سياسة الفريق.'
          : 'مرحباً بك في مساحة عضويتك بفريق أثر.';

    const cards = [...adminArea.querySelectorAll('.admin-grid article')];

    cards.forEach((card, i) => {
      card.hidden = role === 'member' || (role === 'moderator' && i === 0);
    });

    document.querySelector('.admin-notice').textContent =
      role === 'member'
        ? 'هذه مساحة العضو. لا تملك صلاحيات إدارة الموقع أو بيانات الأعضاء.'
        : role === 'moderator'
          ? 'تُحدد صلاحيات المشرف من سياسات قاعدة البيانات، ولا تشمل إدارة حساب الأدمن الرئيسي.'
          : 'تُنفّذ صلاحيات الإدارة من خلال سياسات قاعدة البيانات والوظائف الآمنة على الخادم.';

    resetMfaInterface();
    adminArea.hidden = false;
    hideLogin();

    adminArea.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start'
    });
  };

  // Enroll a new TOTP factor for an administrator
  const enrollAdminMfa = async () => {
    const { data: factors, error: factorError } =
      await authClient.auth.mfa.listFactors();

    if (factorError) {
      setAuthMessage('تعذر قراءة إعدادات المصادقة الثنائية. حاول مرة أخرى.', 'error');
      return false;
    }

    const verifiedFactor = factors?.totp?.find(
      item => item.status === 'verified'
    );

    if (verifiedFactor) {
      return startMfaChallenge(verifiedFactor.id);
    }

    // Remove only unfinished, unverified TOTP enrollments before creating a new one.
    const unfinishedFactors = (factors?.totp || []).filter(
      item => item.status === 'unverified'
    );

    for (const item of unfinishedFactors) {
      const { error } = await authClient.auth.mfa.unenroll({
        factorId: item.id
      });

      if (error) {
        setAuthMessage(
          'يوجد إعداد مصادقة غير مكتمل. تعذر إعادة تهيئته؛ حاول مجدداً.',
          'error'
        );
        return false;
      }
    }

    const { data, error } = await authClient.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Athar Admin Authenticator'
    });

    if (error || !data?.id || !data?.totp?.qr_code || !data?.totp?.secret) {
      setAuthMessage(
        'تعذر إنشاء إعداد المصادقة الثنائية. حاول مرة أخرى.',
        'error'
      );
      return false;
    }

    pendingMfa = {
      factorId: data.id,
      mode: 'enroll'
    };

    mfaQr.src = data.totp.qr_code;
    mfaSecret.textContent = data.totp.secret;
    mfaSetupWrap.hidden = false;

    prepareMfaInterface();

    setAuthMessage(
      'امسح رمز QR بتطبيق المصادقة، ثم أدخل الرمز المكوّن من 6 أرقام لتأكيد الربط.',
      ''
    );

    return false;
  };

  // Start a challenge for an already verified TOTP factor
  const startMfaChallenge = async factorId => {
    pendingMfa = {
      factorId,
      mode: 'verify'
    };

    mfaSetupWrap.hidden = true;
    prepareMfaInterface();

    setAuthMessage(
      'أدخل الرمز الحالي من تطبيق المصادقة لإكمال تسجيل الدخول.',
      ''
    );

    return false;
  };

  // Require MFA for all staff accounts
  const requireMfa = async user => {
    const role = user?.app_metadata?.role || 'member';

    if (role === 'member') {
      await showDashboard(user);
      return true;
    }

    const { data: aal, error: aalError } =
      await authClient.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalError) {
      setAuthMessage('تعذر التحقق بخطوتين. حاول مجدداً.', 'error');
      return false;
    }

    if (aal?.currentLevel === 'aal2') {
      await showDashboard(user);
      return true;
    }

    const { data: factors, error: factorError } =
      await authClient.auth.mfa.listFactors();

    if (factorError) {
      setAuthMessage('تعذر قراءة إعدادات المصادقة الثنائية.', 'error');
      return false;
    }

    const verifiedFactor = factors?.totp?.find(
      item => item.status === 'verified'
    );

    if (verifiedFactor) {
      return startMfaChallenge(verifiedFactor.id);
    }

    // No verified factor exists: open the first-time enrollment screen.
    showLogin(false);
    return enrollAdminMfa();
  };

  // Restore an existing session
  if (!authClient) {
    setAuthMessage(
      'يلزم إعداد Supabase في ملف index.html لتفعيل تسجيل الدخول.',
      ''
    );
  } else {
    authClient.auth.getSession().then(async ({ data, error }) => {
      if (!error && data.session) {
        await requireMfa(data.session.user);
      }
    });

    authClient.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        adminArea.hidden = true;
        resetMfaInterface();
      }
    });
  }

  // Login and MFA verification
  loginForm?.addEventListener('submit', async event => {
    event.preventDefault();

    if (!authClient) {
      setAuthMessage(
        'لم يتم إعداد Supabase بعد. أضف رابط المشروع والمفتاح العام أولاً.',
        'error'
      );
      return;
    }

    const submit = document.getElementById('loginSubmit');

    submit.disabled = true;
    submit.textContent = 'جارٍ التحقق…';
    setAuthMessage('');

    try {
      if (pendingMfa) {
        const code = otpInput.value.trim();

        if (!/^[0-9]{6}$/.test(code)) {
          throw new Error('رمز التحقق يجب أن يتكون من 6 أرقام.');
        }

        // Create a fresh challenge for this verification attempt.
        const { data: challenge, error: challengeError } =
          await authClient.auth.mfa.challenge({
            factorId: pendingMfa.factorId
          });

        if (challengeError || !challenge?.id) {
          throw challengeError || new Error('تعذر إنشاء تحدي التحقق.');
        }

        const { data, error } = await authClient.auth.mfa.verify({
          factorId: pendingMfa.factorId,
          challengeId: challenge.id,
          code
        });

        if (error) throw error;

        const verifiedUser = data?.user;

        if (!verifiedUser) {
          throw new Error('لم يتم استلام بيانات الحساب بعد التحقق.');
        }

        await showDashboard(verifiedUser);

        setAuthMessage('تم تفعيل المصادقة الثنائية وتسجيل الدخول بنجاح.', 'success');
      } else {
        const email = loginEmail.value.trim();
        const password = loginPassword.value;

        const { data, error } = await authClient.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        await requireMfa(data.user);
      }
    } catch (error) {
      console.error('Authentication error:', error);

      setAuthMessage(
        pendingMfa
          ? 'تعذر التحقق من الرمز. تأكد من إدخال الرمز الحالي من التطبيق وحاول مجدداً.'
          : 'تعذر تسجيل الدخول. تأكد من البريد الإلكتروني وكلمة المرور.',
        'error'
      );
    } finally {
      submit.disabled = false;
      submit.textContent = pendingMfa ? 'تأكيد الرمز' : 'تسجيل الدخول';
    }
  });

  // Logout
  document.getElementById('logoutButton')?.addEventListener('click', async () => {
    if (authClient) {
      await authClient.auth.signOut();
    }

    adminArea.hidden = true;
    resetMfaInterface();

    window.scrollTo({
      top: 0,
      behavior: reducedMotion ? 'auto' : 'smooth'
    });
  });

})();
