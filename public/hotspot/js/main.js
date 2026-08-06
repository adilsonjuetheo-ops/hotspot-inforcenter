const API = '';  // mesmo origin
const IS_DEMO = window.location.hostname.endsWith('github.io');

let currentMode = 'client';
let currentPhone = '';
let countdownInterval = null;
let urlParams = {};
let otpEnabled = false; // validação por SMS desativada por padrão — settings do backend podem reativar
let redirectUrl = 'https://inforcenterfibra.com.br';

// DDDs válidos no Brasil (mesma regra do backend)
const VALID_DDDS = new Set([
  '11','12','13','14','15','16','17','18','19','21','22','24','27','28',
  '31','32','33','34','35','37','38','41','42','43','44','45','46','47','48','49',
  '51','53','54','55','61','62','63','64','65','66','67','68','69',
  '71','73','74','75','77','79','81','82','83','84','85','86','87','88','89',
  '91','92','93','94','95','96','97','98','99'
]);

function isValidCellphone(digits) {
  if (digits.length !== 11) return false;
  if (!VALID_DDDS.has(digits.slice(0, 2))) return false;
  if (digits[2] !== '9') return false;
  if (/^(\d)\1+$/.test(digits.slice(2))) return false;
  return true;
}

function isValidCpf(digits) {
  return digits.length === 11 && !/^(\d)\1+$/.test(digits);
}

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  // Captura parâmetros do MikroTik
  const params = new URLSearchParams(window.location.search);
  urlParams = {
    mac: params.get('mac') || params.get('chap-id') || '',
    ip: params.get('ip') || '',
    dst: params.get('dst') || '',
    username: params.get('username') || '',
    linkLogin: params.get('link-login-only') || params.get('link-login') || '',
    linkOrig: params.get('link-orig') || '',
    router: params.get('router') || ''
  };

  // Carrega configurações do portal
  try {
    const resp = await fetch(`${API}/api/hotspot/settings`);
    const settings = await resp.json();

    if (settings.hotspot_title) {
      document.getElementById('page-title').textContent = settings.hotspot_title;
      document.title = settings.hotspot_title + ' — Inforcenter';
    }
    if (settings.hotspot_subtitle) {
      document.getElementById('page-subtitle').textContent = settings.hotspot_subtitle;
    }
    if (settings.require_name === '0') {
      document.getElementById('name-group').classList.add('hidden');
    }
    if (settings.require_email === '1') {
      document.getElementById('email-group').classList.remove('hidden');
    }
    otpEnabled = settings.otp_enabled === '1';
    if (settings.redirect_url) {
      redirectUrl = settings.redirect_url;
      const visitBtn = document.getElementById('btn-visit');
      if (visitBtn) visitBtn.href = redirectUrl;
    }
  } catch (_) {}

  // Ajusta o botão do fluxo visitante conforme o fluxo (com ou sem SMS)
  document.getElementById('btn-send-otp').textContent = otpEnabled
    ? 'Receber código por SMS'
    : 'Conectar ao Wi-Fi Grátis';

  // Setup OTP inputs
  setupOTPInputs();

  // Formata telefone
  const phoneInput = document.getElementById('input-phone');
  phoneInput.addEventListener('input', () => {
    phoneInput.value = formatPhone(phoneInput.value);
  });

  // Formata CPF
  const cpfInput = document.getElementById('input-cpf');
  cpfInput.addEventListener('input', () => {
    cpfInput.value = formatCpf(cpfInput.value);
  });
});

// ===== Alternância entre fluxo Cliente (CPF) e Visitante (lead) =====
function switchMode(mode) {
  currentMode = mode;
  document.getElementById('tab-client').classList.toggle('active', mode === 'client');
  document.getElementById('tab-visitor').classList.toggle('active', mode === 'visitor');
  document.getElementById('form-client').classList.toggle('hidden', mode !== 'client');
  document.getElementById('form-visitor').classList.toggle('hidden', mode !== 'visitor');
  clearAlert();
}

function formatCpf(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0,3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`;
  return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
}

function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
}

// ===== Fluxo CLIENTE: identificação só pelo CPF (validado contra o IXC) =====
async function cpfLogin() {
  const cpf = document.getElementById('input-cpf').value;
  const digits = cpf.replace(/\D/g, '');

  if (!isValidCpf(digits)) {
    showAlert('error', 'Digite um CPF válido.');
    return;
  }

  const btn = document.getElementById('btn-cpf-login');
  setLoading(btn, true, 'Verificando...');
  clearAlert();

  // Modo demonstração (GitHub Pages) — não há backend real para consultar o IXC
  if (IS_DEMO) {
    await new Promise(r => setTimeout(r, 1200));
    document.getElementById('success-title').textContent = 'Bem-vindo(a) de volta!';
    document.getElementById('success-subtitle').textContent = 'Acesso liberado com seu login de cliente Inforcenter.';
    document.getElementById('free-time-display').textContent = 480;
    goToStep(3);
    showAlert('info', '🔒 Modo demo — em produção o CPF é validado direto no sistema da Inforcenter (IXC) e o acesso é liberado no MikroTik.');
    setLoading(btn, false, 'Entrar e conectar');
    return;
  }

  try {
    const resp = await fetch(`${API}/api/hotspot/cpf-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cpf: digits,
        mac: urlParams.mac,
        ip: urlParams.ip,
        router: urlParams.router
      })
    });
    const data = await resp.json();

    if (!resp.ok) throw new Error(data.error || 'Não foi possível liberar o acesso.');

    document.getElementById('success-title').textContent = data.name
      ? `Bem-vindo(a), ${data.name.split(' ')[0]}!`
      : 'Bem-vindo(a) de volta!';
    document.getElementById('success-subtitle').textContent = 'Acesso liberado com seu login de cliente Inforcenter.';
    document.getElementById('free-time-display').textContent = data.freeTimeMinutes || 480;

    if (data.username && data.password) {
      document.getElementById('cred-user').textContent = data.username;
      document.getElementById('cred-pass').textContent = data.password;
      document.getElementById('credentials-area').classList.remove('hidden');
    }

    goToStep(3);
    mikrotikLogin(data.username, data.password);
  } catch (err) {
    showAlert('error', err.message);
  } finally {
    setLoading(btn, false, 'Entrar e conectar');
  }
}

async function sendOTP() {
  const phone = document.getElementById('input-phone').value;
  const name = document.getElementById('input-name').value.trim();
  const email = document.getElementById('input-email')?.value.trim();

  const digits = phone.replace(/\D/g, '');
  if (!isValidCellphone(digits)) {
    showAlert('error', 'Digite um número de celular válido com DDD (ex: 38 9 9999-9999).');
    return;
  }

  // Fluxo sem SMS: conecta direto
  if (!otpEnabled) {
    return connectDirect(digits, name, email);
  }

  const btn = document.getElementById('btn-send-otp');
  setLoading(btn, true, 'Enviando SMS...');
  clearAlert();

  try {
    const resp = await fetch(`${API}/api/hotspot/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: digits, name, email })
    });
    const data = await resp.json();

    if (!resp.ok) throw new Error(data.error || 'Erro ao enviar SMS');

    currentPhone = digits;
    document.getElementById('phone-display').textContent = formatPhone(phone);

    goToStep(2);
    startCountdown(60);

    if (data.debug_code) {
      showAlert('info', `[MODO DEV] Código: ${data.debug_code}`);
    } else {
      showAlert('success', '✅ Código enviado! Verifique seu WhatsApp ou SMS.');
    }
  } catch (err) {
    showAlert('error', err.message);
  } finally {
    setLoading(btn, false, 'Receber código por SMS');
  }
}

// Fluxo sem OTP (visitante): salva o lead e libera o acesso direto no MikroTik
async function connectDirect(digits, name, email) {
  const btn = document.getElementById('btn-send-otp');
  setLoading(btn, true, 'Conectando...');
  clearAlert();

  // Modo demonstração (GitHub Pages)
  if (IS_DEMO) {
    await new Promise(r => setTimeout(r, 1000));
    document.getElementById('success-title').textContent = 'Conectado com sucesso!';
    document.getElementById('success-subtitle').textContent = 'Bem-vindo ao Wi-Fi da Inforcenter. Aproveite a internet!';
    document.getElementById('free-time-display').textContent = 60;
    goToStep(3);
    showAlert('info', '🔒 Modo demo — em produção o acesso seria liberado no MikroTik.');
    setLoading(btn, false, 'Conectar ao Wi-Fi Grátis');
    return;
  }

  try {
    const resp = await fetch(`${API}/api/hotspot/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: digits,
        name,
        email,
        mac: urlParams.mac,
        ip: urlParams.ip,
        router: urlParams.router
      })
    });
    const data = await resp.json();

    if (!resp.ok) throw new Error(data.error || 'Erro ao liberar acesso.');

    document.getElementById('success-title').textContent = 'Conectado com sucesso!';
    document.getElementById('success-subtitle').textContent = 'Bem-vindo ao Wi-Fi da Inforcenter. Aproveite a internet!';
    document.getElementById('free-time-display').textContent = data.freeTimeMinutes || 60;

    if (data.username && data.password) {
      document.getElementById('cred-user').textContent = data.username;
      document.getElementById('cred-pass').textContent = data.password;
      document.getElementById('credentials-area').classList.remove('hidden');
    }

    goToStep(3);
    mikrotikLogin(data.username, data.password);
  } catch (err) {
    showAlert('error', err.message);
  } finally {
    setLoading(btn, false, 'Conectar ao Wi-Fi Grátis');
  }
}

// Faz o login no MikroTik via navegação GET (evita bloqueio de formulário HTTPS→HTTP)
function mikrotikLogin(username, password) {
  if (!urlParams.linkLogin || !username) return;
  setTimeout(() => {
    const dst = urlParams.dst || urlParams.linkOrig || redirectUrl;
    const url = `${urlParams.linkLogin}?username=${encodeURIComponent(username)}` +
      `&password=${encodeURIComponent(password)}&dst=${encodeURIComponent(dst)}`;
    window.location.href = url;
  }, 2000);
}

async function verifyOTP() {
  const inputs = document.querySelectorAll('.otp-input');
  const code = Array.from(inputs).map(i => i.value).join('');

  if (code.length !== 6) {
    showAlert('error', 'Digite todos os 6 dígitos do código.');
    return;
  }

  const name = document.getElementById('input-name').value.trim();
  const email = document.getElementById('input-email')?.value.trim();

  const btn = document.getElementById('btn-verify');
  setLoading(btn, true, 'Verificando...');
  clearAlert();

  try {
    const resp = await fetch(`${API}/api/hotspot/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: currentPhone,
        code,
        name,
        email,
        mac: urlParams.mac,
        ip: urlParams.ip,
        router: urlParams.router
      })
    });
    const data = await resp.json();

    if (!resp.ok) throw new Error(data.error || 'Código inválido.');

    // Para o countdown
    clearInterval(countdownInterval);

    document.getElementById('success-title').textContent = 'Conectado com sucesso!';
    document.getElementById('success-subtitle').textContent = 'Bem-vindo ao Wi-Fi da Inforcenter. Aproveite a internet!';

    // Mostra tempo de acesso
    document.getElementById('free-time-display').textContent = data.freeTimeMinutes || 60;

    // Mostra credenciais se houver
    if (data.username && data.password) {
      document.getElementById('cred-user').textContent = data.username;
      document.getElementById('cred-pass').textContent = data.password;
      document.getElementById('credentials-area').classList.remove('hidden');
    }

    goToStep(3);

    // Se MikroTik retornou credenciais, tenta fazer login automático
    mikrotikLogin(data.username, data.password);
  } catch (err) {
    showAlert('error', err.message);
    // Limpa os inputs de OTP
    document.querySelectorAll('.otp-input').forEach(i => {
      i.value = '';
      i.classList.remove('filled');
    });
    document.querySelectorAll('.otp-input')[0].focus();
  } finally {
    setLoading(btn, false, 'Confirmar e Conectar');
  }
}

async function resendOTP() {
  const btn = document.getElementById('resend-btn');
  btn.disabled = true;
  clearAlert();

  try {
    const resp = await fetch(`${API}/api/hotspot/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: currentPhone })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error);
    showAlert('success', 'Novo código enviado!');
    startCountdown(60);

    if (data.debug_code) showAlert('info', `[DEV] Código: ${data.debug_code}`);
  } catch (err) {
    showAlert('error', err.message);
    btn.disabled = false;
  }
}

function goBack() {
  clearInterval(countdownInterval);
  clearAlert();
  goToStep(1);
}

function goToStep(step) {
  document.querySelectorAll('[id^="step-"]').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.step-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i + 1 === step);
    dot.classList.toggle('done', i + 1 < step);
  });
  document.getElementById(`step-${step}`).classList.remove('hidden');
}

function startCountdown(seconds) {
  clearInterval(countdownInterval);
  let remaining = seconds;
  const countdownEl = document.getElementById('countdown');
  const resendText = document.getElementById('resend-text');
  const resendBtn = document.getElementById('resend-btn');

  resendText.style.display = 'inline';
  resendBtn.style.display = 'none';
  resendBtn.disabled = true;

  countdownInterval = setInterval(() => {
    remaining--;
    countdownEl.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      resendText.style.display = 'none';
      resendBtn.style.display = 'inline';
      resendBtn.disabled = false;
    }
  }, 1000);
}

function setupOTPInputs() {
  const inputs = document.querySelectorAll('.otp-input');
  inputs.forEach((input, idx) => {
    input.addEventListener('input', e => {
      const val = e.target.value.replace(/\D/g, '');
      e.target.value = val.slice(-1);
      e.target.classList.toggle('filled', val.length > 0);
      if (val && idx < inputs.length - 1) inputs[idx + 1].focus();
      if (Array.from(inputs).every(i => i.value)) verifyOTP();
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !e.target.value && idx > 0) {
        inputs[idx - 1].focus();
        inputs[idx - 1].value = '';
        inputs[idx - 1].classList.remove('filled');
      }
    });
    input.addEventListener('paste', e => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      pasted.split('').forEach((char, i) => {
        if (inputs[i]) {
          inputs[i].value = char;
          inputs[i].classList.add('filled');
        }
      });
      if (pasted.length === 6) verifyOTP();
      else if (inputs[pasted.length]) inputs[pasted.length].focus();
    });
  });
}

function showAlert(type, message) {
  const area = document.getElementById('alert-area');
  area.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
}

function clearAlert() {
  document.getElementById('alert-area').innerHTML = '';
}

function setLoading(btn, loading, text) {
  btn.disabled = loading;
  btn.innerHTML = loading ? `<span class="spinner"></span>${text}` : text;
}

// ===== Modal de Termos de Uso =====
function openTerms() {
  document.getElementById('terms-modal').classList.remove('hidden');
}

function closeTerms() {
  document.getElementById('terms-modal').classList.add('hidden');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeTerms();
});
