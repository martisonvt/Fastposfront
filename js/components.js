// Toast notifications
function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast-item toast-${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// Confirm dialog
function confirmDialog(msg) {
  return confirm(msg);
}

// Sidebar active link
function setActiveNav(href) {
  document.querySelectorAll('.sidebar-nav .nav-link').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === href);
  });
}

// Mostrar vendedor logado na sidebar
function renderVendedorSidebar() {
  const v = getVendedor();
  const el = document.getElementById('sidebar-vendedor');
  if (el && v) {
    el.textContent = v.nome;
  }
}

// Sidebar toggle para mobile/tablet — chamado automaticamente por renderSidebar()
function initSidebarToggle() {
  // Proteção contra inicialização dupla
  if (window._sidebarToggleInit) return;
  window._sidebarToggleInit = true;

  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) { window._sidebarToggleInit = false; return; }

  // Cria overlay
  let overlay = document.getElementById('sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'sidebar-overlay';
    document.body.appendChild(overlay);
  }

  // Cria botão flutuante ☰
  let btn = document.getElementById('sidebar-toggle');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'sidebar-toggle';
    btn.title = 'Menu';
    btn.innerHTML = '<i class="bi bi-list"></i>';
    btn.style.cssText = [
      'position:fixed',
      // top dinâmico: somado ao banner offline quando visível (--banner-h)
      'top:calc(12px + var(--banner-h, 0px))',
      'left:12px', 'z-index:1100',
      'width:40px', 'height:40px', 'border-radius:8px',
      'background:#1a2540', 'color:#fff', 'border:none',
      'font-size:1.3rem', 'display:flex', 'align-items:center',
      'justify-content:center', 'box-shadow:0 2px 8px rgba(0,0,0,.35)',
      'cursor:pointer', 'touch-action:manipulation',
      'transition:top .15s ease'
    ].join(';');
    document.body.appendChild(btn);
  }

  function abrirSidebar()  { sidebar.classList.add('open');    overlay.classList.add('show');    btn.style.display = 'none'; document.body.classList.add('sidebar-open'); }
  function fecharSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('show'); btn.style.display = ''; document.body.classList.remove('sidebar-open'); }

  // Só mostra o botão em telas ≤992px
  function ajustarBotao() {
    if (window.innerWidth <= 992) {
      if (!sidebar.classList.contains('open')) btn.style.display = 'flex';
    } else {
      btn.style.display = 'none';
      fecharSidebar();
    }
  }
  ajustarBotao();
  window.addEventListener('resize', ajustarBotao);

  btn.addEventListener('click', function() { sidebar.classList.contains('open') ? fecharSidebar() : abrirSidebar(); });
  overlay.addEventListener('click', fecharSidebar);

  // Botão × dentro da sidebar fecha o menu
  var closeBtn = document.getElementById('sidebar-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', fecharSidebar);

  // Fecha ao navegar
  sidebar.querySelectorAll('.nav-link').forEach(a => a.addEventListener('click', fecharSidebar));
}

// Loading spinner em botões
function btnLoading(btn, loading) {
  if (loading) {
    btn._orig = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn._orig || btn.innerHTML;
    btn.disabled = false;
  }
}

// Verificar login (usa getLoginUrl() de utils.js para redirecionar corretamente)
function requireLogin() {
  const v = getVendedor();
  if (!v) {
    window.location.href = (typeof getLoginUrl === 'function') ? getLoginUrl() : '/';
    return false;
  }
  return true;
}

// Sidebar HTML compartilhado
function renderSidebar(activePage) {
  const v = getVendedor();
  const admin = v && v.is_admin === true;
  let perms = [];
  try { perms = JSON.parse((v && v.permissoes) || '[]'); } catch (e) {}
  const pode = (mod) => admin || perms.includes(mod);

  const links = [
    { href: '/pages/dashboard.html', icon: 'bi-speedometer2', label: 'Dashboard', perm: 'dashboard' },
    { type: 'section', label: 'VENDAS' },
    { href: '/pages/caixa.html',      icon: 'bi-cart3',        label: 'Caixa / PDV' },
    { href: '/pages/orcamentos.html', icon: 'bi-file-text',    label: 'Orçamentos', badgeId: 'badge-novos-pedidos' },
    { href: '/pages/mesas.html',      icon: 'bi-grid-3x3',    label: 'Mesas',       perm: 'mesas' },
    { href: '/pages/vendas.html',     icon: 'bi-receipt',      label: 'Histórico de Vendas', perm: 'historico_vendas' },
    { href: '/pages/caixa-sessoes.html', icon: 'bi-cash-coin', label: 'Gestão de Caixa', perm: 'gestao_caixa' },
    { type: 'section', label: 'CADASTROS', perm: '_cadastros' },
    { href: '/pages/produtos.html',   icon: 'bi-box-seam',     label: 'Produtos',    perm: 'produtos' },
    { href: '/pages/clientes.html',   icon: 'bi-people',       label: 'Clientes',    perm: 'clientes' },
    { href: '/pages/fiado.html',      icon: 'bi-wallet2',      label: 'Fiado',        perm: 'fiado' },
    { href: '/pages/vendedores.html',    icon: 'bi-person-badge',  label: 'Vendedores',    perm: 'vendedores' },
    { href: '/pages/configuracoes.html', icon: 'bi-gear-fill',    label: 'Dados da Loja', perm: 'configuracoes' },
    { href: '/pages/categorias.html',    icon: 'bi-tags',         label: 'Categorias',    perms: ['categorias','produtos'] },
    { type: 'section', label: 'OPERAÇÕES', perm: '_ops' },
    { href: '/pages/estoque.html',              icon: 'bi-archive',         label: 'Estoque',            perm: 'estoque' },
    { href: '/pages/relatorios.html',           icon: 'bi-bar-chart-line',  label: 'Relatórios',         perm: 'relatorios' },
    { href: '/pages/dashboard-restaurante.html',icon: 'bi-bar-chart-fill',  label: 'Rest. Dashboard',    perm: 'mesas' },
    { href: '/pages/impressao.html',  icon: 'bi-printer',         label: 'Impressora',  perm: 'impressora' },
    { type: 'section', label: 'LOJA ONLINE', perm: '_loja' },
    { href: '#',                       icon: 'bi-shop',    label: 'Ver Loja Online', perm: 'loja_ver',    onclick: 'abrirModalLoja()' },
    { href: '/pages/loja-config.html', icon: 'bi-sliders', label: 'Config. da Loja', perm: 'loja_config' },
    { type: 'section', label: 'AJUDA' },
    { href: '/pages/ajuda.html', icon: 'bi-book', label: 'Manual / Ajuda' },
    { type: 'section', label: 'CONTA', adminOnly: true },
    { href: '/pages/minha-empresa.html', icon: 'bi-building',    label: 'Minha Empresa', adminOnly: true },
    { href: '/pages/assinatura.html',    icon: 'bi-credit-card', label: 'Assinatura',     adminOnly: true },
  ];

  let html = `
    <div class="sidebar">
      <div class="sidebar-brand-row">
        <div class="sidebar-brand">
          <h5><i class="bi bi-shop me-1"></i> <span id="sidebar-brand-nome">PDV</span></h5>
          <small id="sidebar-brand-sub">Ponto de Venda</small>
        </div>
        <button class="sidebar-close-btn" id="sidebar-close-btn" title="Fechar menu"><i class="bi bi-x-lg"></i></button>
      </div>
      <nav class="sidebar-nav">
  `;

  for (const l of links) {
    if (l.type === 'section') {
      // Seções com adminOnly: só admins veem
      if (l.adminOnly && !admin) continue;
      // Seções especiais: mostra se tiver ao menos 1 item visível dentro
      if (l.perm === '_cadastros') {
        if (!pode('produtos') && !pode('categorias') && !pode('clientes') && !pode('fiado') && !pode('vendedores') && !pode('configuracoes') && !admin) continue;
      } else if (l.perm === '_ops') {
        if (!pode('estoque') && !pode('relatorios') && !pode('mesas')) continue;
      } else if (l.perm === '_loja') {
        if (!pode('loja_ver') && !pode('loja_config') && !admin) continue;
      } else if (l.perm && !pode(l.perm)) {
        continue;
      }
      html += `<div class="nav-section">${l.label}</div>`;
    } else {
      if (l.adminOnly && !admin) continue;
      if (l.perm && !pode(l.perm)) continue;
      if (l.perms && !l.perms.some(p => pode(p))) continue;
      const active      = l.href === activePage ? 'active' : '';
      const badge       = l.badgeId ? `<span id="${l.badgeId}" class="badge bg-danger ms-auto" style="display:none;font-size:.6rem"></span>` : '';
      const targetAttr  = l.target  ? ` target="${l.target}"` : '';
      const onclickAttr = l.onclick ? ` onclick="${l.onclick};return false"` : '';
      html += `<a href="${l.href}"${targetAttr}${onclickAttr} class="nav-link ${active}" style="display:flex;align-items:center;gap:.35rem"><i class="bi ${l.icon}"></i> ${l.label}${badge}</a>`;
    }
  }

  const perfil = admin
    ? `<span class="badge bg-warning text-dark ms-1" style="font-size:.65rem">ADM</span>`
    : '';

  html += `
      </nav>
      <div class="sidebar-footer">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div><i class="bi bi-person-circle me-1"></i><span id="sidebar-vendedor">${v ? v.nome : 'Não logado'}</span>${perfil}</div>
          <a href="#" onclick="abrirModalSuporte();return false" title="Suporte / Ajuda" style="color:#8fa3b8;font-size:.9rem;line-height:1"><i class="bi bi-question-circle"></i></a>
        </div>
        ${v ? `
        <div class="d-flex align-items-center justify-content-between mt-1">
          <a href="#" onclick="logout()" class="text-danger" style="font-size:0.75rem"><i class="bi bi-box-arrow-right"></i> Sair</a>
          <a href="#" onclick="_sincronizarApp(this);return false" id="btn-sync-app" title="Sincronizar com o servidor" style="font-size:0.75rem;color:#7fba8a">
            <i class="bi bi-arrow-clockwise" id="icon-sync-app"></i> Sincronizar
          </a>
        </div>` : ''}
      </div>
    </div>
    <div id="toast-container"></div>
  `;
  // Modal "Ver Loja Online" (injeta uma única vez no body)
  if (!document.getElementById('modal-loja-online')) {
    const modalEl = document.createElement('div');
    modalEl.innerHTML = `
      <div class="modal fade" id="modal-loja-online" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-0 shadow-lg" style="border-radius:16px;overflow:hidden">
            <div class="modal-header text-white border-0" style="background:linear-gradient(135deg,#0d1b2a,#1a2540)">
              <h5 class="modal-title fw-bold" style="color:#fff!important"><i class="bi bi-shop me-2"></i>Loja Online</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body text-center p-4">
              <p class="text-muted mb-3">Compartilhe ou acesse a loja online</p>
              <div class="d-flex justify-content-center mb-3">
                <img id="loja-qrcode" src="" alt="QR Code" style="width:180px;height:180px;border-radius:8px;border:3px solid #e2e8f0">
                <div id="loja-qr-offline" style="display:none;width:180px;height:180px;border-radius:8px;border:3px solid #e2e8f0;background:#f8f9fa;color:#6c757d;font-size:.8rem;text-align:center;padding:2rem .5rem">
                  <i class="bi bi-wifi-off" style="font-size:2rem;margin-bottom:.5rem"></i>
                  QR indisponível offline
                </div>
              </div>
              <div class="input-group mb-3">
                <input type="text" id="loja-url-input" class="form-control text-center" readonly style="font-size:.85rem;background:#f8faff">
                <button class="btn btn-outline-secondary" onclick="_copiarUrlLoja()" title="Copiar link">
                  <i class="bi bi-clipboard" id="icon-copiar-loja"></i>
                </button>
              </div>
              <div class="d-grid gap-2">
                <button class="btn btn-success" onclick="_compartilharLoja()">
                  <i class="bi bi-share me-2"></i>Compartilhar
                </button>
                <button class="btn btn-outline-secondary" onclick="_abrirLojaNavegador()">
                  <i class="bi bi-box-arrow-up-right me-2"></i>Abrir no Navegador
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modalEl.firstElementChild);
  }

  // Injeta modal de suporte (uma única vez)
  if (!document.getElementById('modal-suporte')) {
    const ms = document.createElement('div');
    ms.innerHTML = `
      <div class="modal fade" id="modal-suporte" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-sm">
          <div class="modal-content">
            <div class="modal-header py-2">
              <h6 class="modal-title fw-bold"><i class="bi bi-question-circle me-2"></i>Suporte & SAC</h6>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body text-center py-4">
              <p class="text-muted small mb-4">Precisa de ajuda? Fale com a nossa equipe.</p>
              <div class="d-grid gap-2">
                <a id="suporte-whatsapp-btn" href="#" target="_blank" class="btn btn-success" style="opacity:.5;pointer-events:none">
                  <i class="bi bi-whatsapp me-2"></i>WhatsApp <span class="badge bg-light text-dark ms-1" style="font-size:.65rem">Em breve</span>
                </a>
                <a id="suporte-email-btn" href="mailto:contato@fastpos.com.br" class="btn btn-outline-secondary">
                  <i class="bi bi-envelope me-2"></i>contato@fastpos.com.br
                </a>
              </div>
              <hr class="my-3">
              <p class="text-muted" style="font-size:.78rem">Horário de atendimento:<br><strong>Seg – Sex, 8h às 18h</strong></p>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(ms.firstElementChild);
  }

  // Carrega configs, inicializa toggle e inicia polling de pedidos da loja
  _carregarConfigLoja();
  setTimeout(initSidebarToggle, 0);
  setTimeout(_iniciarPollingLoja, 500);
  return html;
}

// ── Sincronizar App ────────────────────────────────
async function _sincronizarApp(link) {
  const icon = document.getElementById('icon-sync-app');
  if (icon) { icon.style.animation = 'spin 1s linear infinite'; }
  if (link) { link.style.pointerEvents = 'none'; link.style.opacity = '.6'; }
  try {
    // Limpa caches
    sessionStorage.removeItem('config_loja');
    // Recarrega config da loja
    await _carregarConfigLoja();
    showToast('Sincronizado com sucesso!', 'success');
  } catch(e) {
    showToast('Erro ao sincronizar. Verifique a conexão.', 'error');
  } finally {
    if (icon) { icon.style.animation = ''; }
    if (link) { link.style.pointerEvents = ''; link.style.opacity = ''; }
  }
  // Recarrega a página para buscar dados frescos
  setTimeout(() => location.reload(), 800);
}

// ── Polling: novos pedidos da loja ─────────────────
let _pollingLojaTimer  = null;
let _lojaUltimoCount   = 0;
let _lojaFirstCheck    = true;  // pula som/vibração na primeira checagem da página
let _audioCtx          = null;

// Desbloqueia AudioContext no primeiro toque (necessário no Android/Capacitor)
document.addEventListener('touchstart', function _unlockAudio() {
  if (_audioCtx) return;
  try {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
  } catch(_) {}
  document.removeEventListener('touchstart', _unlockAudio);
}, { once: true });

function _tocarSomNovoPedido() {
  try {
    if (!_audioCtx) {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    // Dois bipes curtos
    [0, 0.18].forEach(delay => {
      const osc  = _audioCtx.createOscillator();
      const gain = _audioCtx.createGain();
      osc.connect(gain);
      gain.connect(_audioCtx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, _audioCtx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.4, _audioCtx.currentTime + delay + 0.02);
      gain.gain.linearRampToValueAtTime(0, _audioCtx.currentTime + delay + 0.12);
      osc.start(_audioCtx.currentTime + delay);
      osc.stop(_audioCtx.currentTime + delay + 0.14);
    });
  } catch(_) {}
}

function _getApiBase() {
  // No app Android (Capacitor) a URL relativa não funciona — usa a do localStorage
  const stored = localStorage.getItem('pdv_server_url');
  if (stored) return stored.replace(/\/+$/, '');
  return '';
}

async function _checarPedidosLoja() {
  try {
    const badge = document.getElementById('badge-novos-pedidos');
    if (!badge) return;
    const hoje = new Date().toISOString().split('T')[0];
    const base = _getApiBase();
    const _tok = sessionStorage.getItem('pdv_token') || localStorage.getItem('pdv_token') || '';
    const _tenant = localStorage.getItem('pdv_subdominio') || '';
    const _headers = {};
    if (_tok) _headers['Authorization'] = 'Bearer ' + _tok;
    if (_tenant) _headers['X-Tenant'] = _tenant;
    const r = await fetch(`${base}/api/orcamentos/?status=ativo&data_inicio=${hoje}&data_fim=${hoje}`, {
      headers: _headers
    });
    if (!r.ok) return;
    const lista = await r.json();
    const novos = lista.filter(o =>
      o.observacoes && o.observacoes.includes('[PEDIDO LOJA ONLINE]')
    );
    const count = novos.length;
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = '';
      // Toca som só se chegou pedido novo E não é a primeira checagem da página
      if (count > _lojaUltimoCount && !_lojaFirstCheck) {
        _tocarSomNovoPedido();
        // Vibração no celular (Android)
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    } else {
      badge.style.display = 'none';
    }
    _lojaUltimoCount = count;
    _lojaFirstCheck  = false;
  } catch(_) {}
}

function _iniciarPollingLoja() {
  _checarPedidosLoja();
  // Verifica a cada 60 segundos
  _pollingLojaTimer = setInterval(_checarPedidosLoja, 60000);
}

// ── Config da Loja ─────────────────────────────────
window.configLoja = {};

async function _carregarConfigLoja() {
  try {
    // Aplica cache imediato se disponível
    const cached = sessionStorage.getItem('config_loja');
    if (cached) {
      window.configLoja = JSON.parse(cached);
      _aplicarMarcaLoja(window.configLoja);
    }
    // Busca dados frescos
    const cfg = await api.configuracoes.listar();
    window.configLoja = cfg;
    sessionStorage.setItem('config_loja', JSON.stringify(cfg));
    _aplicarMarcaLoja(cfg);
  } catch { /* servidor offline ou sem auth */ }
}

function _aplicarMarcaLoja(cfg) {
  const nome = cfg.nome_empresa && cfg.nome_empresa.trim() ? cfg.nome_empresa.trim() : 'PDV';
  const nomeEl = document.getElementById('sidebar-brand-nome');
  if (nomeEl) nomeEl.textContent = nome;
  // Atualiza title da página (sufixo)
  if (cfg.nome_empresa && cfg.nome_empresa.trim()) {
    document.title = document.title.replace(/- PDV$/, `- ${cfg.nome_empresa.trim()}`);
  }
}

// ── Botão Voltar Android (Capacitor) ───────────────
(function() {
  try {
    if (typeof Capacitor === 'undefined') return;
    var isNative = typeof Capacitor.isNativePlatform === 'function'
      ? Capacitor.isNativePlatform()
      : !!Capacitor.isNative;
    if (!isNative) return;

    var CapApp = Capacitor.Plugins && Capacitor.Plugins.App;
    if (!CapApp) return;

    function _fecharSidebarSeAberta() {
      var sidebar = document.querySelector('.sidebar');
      if (!sidebar || !sidebar.classList.contains('open')) return false;
      sidebar.classList.remove('open');
      document.body.classList.remove('sidebar-open');
      var ov = document.getElementById('sidebar-overlay');
      if (ov) ov.classList.remove('show');
      var btn = document.getElementById('sidebar-toggle');
      if (btn) btn.style.display = '';
      return true;
    }

    var _ultimoBack = 0;
    CapApp.addListener('backButton', function(info) {
      // 1) Fecha sidebar se estiver aberta
      if (_fecharSidebarSeAberta()) return;

      // 2) Fecha modal Bootstrap se houver algum aberto
      var modaisAbertos = document.querySelectorAll('.modal.show');
      if (modaisAbertos.length) {
        var ultimo = modaisAbertos[modaisAbertos.length - 1];
        var inst = window.bootstrap && bootstrap.Modal.getInstance(ultimo);
        if (inst) { inst.hide(); return; }
      }

      // 3) Fecha overlay do carrinho (caixa.html) se estiver aberto
      var cartOverlay = document.getElementById('cart-overlay');
      if (cartOverlay && cartOverlay.style.display !== 'none') {
        if (typeof _fecharCartOverlay === 'function') { _fecharCartOverlay(); return; }
      }

      // 4) Fecha dropdown de autocomplete aberto (se houver)
      var drops = document.querySelectorAll('[id$="-drop"],[id$="-dropdown"]');
      var fechouDrop = false;
      drops.forEach(function(d) { if (d.style.display !== 'none') { d.style.display = 'none'; fechouDrop = true; } });
      if (fechouDrop) return;

      // 5) Sem nada aberto: volta na navegação do histórico
      if (info.canGoBack) {
        window.history.back();
        return;
      }

      // 6) Sem histórico: toque duplo para sair
      var agora = Date.now();
      if (agora - _ultimoBack < 2000) {
        CapApp.exitApp();
      } else {
        _ultimoBack = agora;
        showToast('Pressione voltar novamente para sair', 'info');
      }
    });
  } catch(e) {}
})();

// ── Modal Loja Online ──────────────────────────────
function _getLojaUrl() {
  // Se tiver subdomínio salvo (modo app/universal login), usa ele para montar a URL correta
  const sub = localStorage.getItem('pdv_subdominio');
  if (sub) {
    return `https://${sub}.fastpos.com.br/loja`;
  }
  const _isCapacitor = window.location.protocol === 'capacitor:' || window.Capacitor !== undefined;
  const base = _isCapacitor
    ? (localStorage.getItem('pdv_server_url') || 'http://127.0.0.1:8000')
    : window.location.origin;
  return base.replace(/\/+$/, '') + '/loja';
}

function abrirModalLoja() {
  const url = _getLojaUrl();
  const input = document.getElementById('loja-url-input');
  const qr    = document.getElementById('loja-qrcode');
  if (input) input.value = url;
  if (qr) {
    qr.onerror = function() {
      this.style.display = 'none';
      const aviso = document.getElementById('loja-qr-offline');
      if (aviso) aviso.style.display = 'block';
    };
    qr.style.display = 'block';
    const aviso = document.getElementById('loja-qr-offline');
    if (aviso) aviso.style.display = 'none';
    qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
  }
  const modal = document.getElementById('modal-loja-online');
  if (modal && window.bootstrap) {
    bootstrap.Modal.getOrCreateInstance(modal).show();
  }
}

function _copiarUrlLoja() {
  const url = _getLojaUrl();
  navigator.clipboard.writeText(url).then(() => {
    const icon = document.getElementById('icon-copiar-loja');
    if (icon) { icon.className = 'bi bi-check-lg'; setTimeout(() => { icon.className = 'bi bi-clipboard'; }, 2000); }
    showToast('Link copiado!', 'success');
  }).catch(() => {
    showToast('Não foi possível copiar. Copie manualmente.', 'error');
  });
}

async function _compartilharLoja() {
  const url   = _getLojaUrl();
  const nome  = (window.configLoja && window.configLoja.nome_empresa) || 'Nossa Loja';
  if (navigator.share) {
    try {
      await navigator.share({ title: nome, text: 'Confira nossa loja online!', url });
    } catch(e) { /* usuário cancelou */ }
  } else {
    _copiarUrlLoja();
  }
}

function _abrirLojaNavegador() {
  const url = _getLojaUrl();
  // @capacitor/browser — abre no navegador do sistema (Chrome/padrão), fora do WebView
  var CapBrowser = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser;
  if (CapBrowser && typeof CapBrowser.open === 'function') {
    CapBrowser.open({ url: url });
    return;
  }
  // Fora do app: abre normalmente
  window.open(url, '_blank');
}

// ── Modal Suporte ──────────────────────────────────
function abrirModalSuporte() {
  const modal = document.getElementById('modal-suporte');
  if (modal && window.bootstrap) {
    bootstrap.Modal.getOrCreateInstance(modal).show();
  }
}

// Injeta manifest PWA e registra service worker em todas as páginas
(function _injetarPWA() {
  if (!document.querySelector('link[rel="manifest"]')) {
    const l = document.createElement('link');
    l.rel = 'manifest'; l.href = '/manifest.json';
    document.head.appendChild(l);
  }
  if (!document.querySelector('link[rel="icon"]')) {
    const f = document.createElement('link');
    f.rel = 'icon'; f.type = 'image/png'; f.href = '/icons/icon-192.png';
    document.head.appendChild(f);
  }
  if (!document.querySelector('link[rel="apple-touch-icon"]')) {
    const a = document.createElement('link');
    a.rel = 'apple-touch-icon'; a.href = '/icons/icon-192.png';
    document.head.appendChild(a);
  }
  if (!document.querySelector('meta[name="theme-color"]')) {
    const m = document.createElement('meta');
    m.name = 'theme-color'; m.content = '#2d8a4e';
    document.head.appendChild(m);
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
})();
