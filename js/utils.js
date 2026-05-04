function fmtMoeda(valor) {
  return 'R$ ' + Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtData(dt) {
  if (!dt) return '-';
  const d = new Date(dt);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fmtDataCurta(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleDateString('pt-BR');
}

function fmtQtd(qtd, unidade) {
  const n = Number(qtd || 0);
  const s = n % 1 === 0 ? n.toFixed(0) : n.toFixed(3).replace(/\.?0+$/, '');
  return `${s} ${unidade || 'UN'}`;
}

function badgeEstoque(atual, minimo, unidade) {
  if (atual <= 0) return `<span class="badge-stock stock-empty">Zerado</span>`;
  if (atual <= minimo) return `<span class="badge-stock stock-low">${fmtQtd(atual, unidade)}</span>`;
  return `<span class="badge-stock stock-ok">${fmtQtd(atual, unidade)}</span>`;
}

function badgeStatus(status) {
  const map = {
    concluida: 'success',
    cancelada: 'danger',
    pendente: 'warning',
  };
  return `<span class="badge bg-${map[status] || 'secondary'}">${status}</span>`;
}

function _mascaraTel(el) {
  let v = el.value.replace(/\D/g, '').substring(0, 11);
  if (v.length > 10) {
    v = v.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
  } else if (v.length > 6) {
    v = v.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  } else if (v.length > 2) {
    v = v.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
  } else if (v.length > 0) {
    v = v.replace(/^(\d{0,2})/, '($1');
  }
  el.value = v;
}

function nomePagamento(forma) {
  // Formas customizadas registradas pela página via window._formasConfig
  if (window._formasConfig && window._formasConfig[forma]) return window._formasConfig[forma];
  const map = {
    dinheiro: 'Dinheiro',
    debito: 'Cartão Débito',
    credito: 'Cartão Crédito',
    pix: 'PIX',
    boleto: 'Boleto',
    cheque: 'Cheque',
    fiado: 'Fiado',
    misto: 'Múltiplas formas',
  };
  return map[forma] || forma;
}

// Detecta modo app (fastpos.com.br sem subdomínio = Capacitor app)
function _isAppMode() {
  const h = window.location.hostname;
  return h === 'fastpos.com.br' ||
         window.location.protocol === 'capacitor:' ||
         typeof window.Capacitor !== 'undefined';
}

function getLoginUrl() {
  return _isAppMode() ? '/login-app' : '/';
}

function requireLogin() {
  if (!getVendedor()) {
    window.location.href = getLoginUrl();
    return false;
  }
  return true;
}

function dataHojeISO() {
  const d = new Date();
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0');
}

function inicioMesISO() {
  const d = new Date();
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-01';
}

// Detecta input de scanner (velocidade alta)
function setupScannerDetect(input, callback) {
  let buffer = '';
  let lastTime = 0;
  input.addEventListener('keydown', (e) => {
    const now = Date.now();
    if (e.key === 'Enter') {
      if (buffer.length >= 4) callback(buffer.trim());
      buffer = '';
      return;
    }
    if (now - lastTime > 100) buffer = '';
    buffer += e.key;
    lastTime = now;
  });
}

// Vendedor logado
function getVendedor() {
  return JSON.parse(localStorage.getItem('vendedor') || 'null');
}
function setVendedor(v) {
  // Salva token separado (usado por apiFetch), guarda o resto no objeto
  if (v && v.token) {
    setAuthToken(v.token);
    const { token, ...semToken } = v;
    localStorage.setItem('vendedor', JSON.stringify(semToken));
  } else {
    localStorage.setItem('vendedor', JSON.stringify(v));
  }
}
function logout() {
  localStorage.removeItem('vendedor');
  localStorage.removeItem('pdv_subdominio');
  setAuthToken(null);
  if (typeof setRefreshToken === 'function') setRefreshToken(null);
  else localStorage.removeItem('pdv_refresh_token');
  window.location.href = getLoginUrl();
}

// ── Sistema de Permissões ──────────────────────────────────────────────────────
function isAdmin() {
  const v = getVendedor();
  return v && !!v.is_admin;
}

function temPermissao(modulo) {
  const v = getVendedor();
  if (!v) return false;
  if (!!v.is_admin) return true;
  try {
    const perms = JSON.parse(v.permissoes || '[]');
    return perms.includes(modulo);
  } catch { return false; }
}

function requirePermissao(modulo) {
  if (!getVendedor()) {
    window.location.href = '/';
    return false;
  }
  if (!temPermissao(modulo)) {
    document.body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#f8f9fa">
        <i class="bi bi-shield-lock" style="font-size:4rem;color:#dc3545"></i>
        <h3 style="margin-top:1rem;color:#343a40">Acesso Negado</h3>
        <p style="color:#6c757d">Você não tem permissão para acessar esta página.</p>
        <a href="/" style="margin-top:.5rem;padding:.5rem 1.5rem;background:#2d8a4e;color:#fff;border-radius:6px;text-decoration:none">
          ← Voltar ao Dashboard
        </a>
      </div>
    `;
    return false;
  }
  return true;
}

// Nomes amigáveis dos módulos
const MODULOS_LABEL = {
  dashboard:        'Dashboard',
  historico_vendas: 'Histórico de Vendas',
  produtos:         'Produtos',
  categorias:       'Categorias',
  clientes:         'Clientes',
  fiado:            'Fiado',
  estoque:          'Estoque',
  relatorios:       'Relatórios',
  impressora:       'Impressora',
  gestao_caixa:     'Gestão de Caixa',
  vendedores:       'Vendedores',
  configuracoes:    'Dados da Loja',
  loja_ver:         'Ver Loja Online',
  loja_config:      'Config. da Loja',
  mesas:            'Mesas',
};
const TODOS_MODULOS = Object.keys(MODULOS_LABEL);

// ── Compartilhar Comprovante como Imagem ───────────────────────────────────────

// Carrega html2canvas sob demanda (só quando o usuário clicar em Compartilhar)
function _garantirHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve();
  return new Promise(function(resolve, reject) {
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    s.onload = resolve;
    s.onerror = function() { reject(new Error('Falha ao carregar html2canvas')); };
    document.head.appendChild(s);
  });
}

// Monta o HTML do comprovante visual com inline styles (necessário para html2canvas)
function _buildShareReceiptHtml(dados) {
  var cfg      = window.configLoja || {};
  var nomeLoja = (cfg.nome_empresa || 'PDV').trim();
  var inicial  = nomeLoja.charAt(0).toUpperCase();
  var rodape   = (cfg.rodape && cfg.rodape.trim()) ? cfg.rodape.trim() : 'Obrigado pela compra!';

  // Cabeçalho da loja
  var headerInfo = '';
  if (cfg.endereco)  headerInfo += '<div style="font-size:12px;opacity:.82;margin:3px 0">'  + cfg.endereco  + '</div>';
  if (cfg.cidade_uf) headerInfo += '<div style="font-size:12px;opacity:.82;margin:3px 0">'  + cfg.cidade_uf + '</div>';
  if (cfg.cnpj)      headerInfo += '<div style="font-size:12px;opacity:.82;margin:3px 0">CNPJ: ' + cfg.cnpj + '</div>';
  if (cfg.telefone)  headerInfo += '<div style="font-size:12px;opacity:.82;margin:3px 0">Tel: '  + cfg.telefone + '</div>';

  // Itens
  var itensHtml = dados.itens.map(function(i) {
    var fotoHtml = i.foto_url
      ? '<img src="' + i.foto_url + '" style="width:52px;height:52px;border-radius:8px;object-fit:cover;flex-shrink:0;display:block">'
      : '<div style="width:52px;height:52px;border-radius:8px;background:#e8e8e8;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:22px">&#128722;</div>';

    var precoHtml = i.preco_original
      ? '<span style="text-decoration:line-through;color:#bbb;font-size:12px">' + fmtMoeda(i.preco_original) + '</span> <span style="color:#555;font-size:13px">' + fmtMoeda(i.preco_unitario) + '</span>'
      : '<span style="color:#666;font-size:13px">' + fmtMoeda(i.preco_unitario) + '</span>';

    var qtdLabel = String(i.quantidade) + (i.unidade && i.unidade !== 'UN' ? ' ' + i.unidade : '');

    return '<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid #f0f0f0">'
      + fotoHtml
      + '<div style="flex:1;min-width:0">'
      +   '<div style="font-weight:600;color:#222;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + i.nome + '</div>'
      +   '<div style="margin-top:3px">' + precoHtml + '</div>'
      + '</div>'
      + '<div style="text-align:right;flex-shrink:0;padding-left:8px">'
      +   '<div style="color:#999;font-size:12px">x' + qtdLabel + '</div>'
      +   '<div style="font-weight:700;color:#222;font-size:14px">' + fmtMoeda(i.subtotal) + '</div>'
      + '</div>'
      + '</div>';
  }).join('');

  // Total de itens
  var totalItensQtd = dados.itens.reduce(function(s, i) { return s + Number(i.quantidade); }, 0);
  var totalItensStr = totalItensQtd % 1 === 0
    ? totalItensQtd + (totalItensQtd === 1 ? ' item' : ' itens')
    : totalItensQtd.toFixed(3).replace('.', ',') + ' itens';

  // Resumo financeiro
  var subtotalVal = dados.subtotal > 0 ? dados.subtotal : dados.total;
  var resumoHtml =
    '<div style="display:flex;justify-content:space-between;margin-bottom:8px;color:#666;font-size:13px">'
    + '<span>Total de itens</span><span style="font-weight:600;color:#333">' + totalItensStr + '</span></div>'
    + '<div style="display:flex;justify-content:space-between;margin-bottom:8px;color:#666;font-size:13px">'
    + '<span>Subtotal</span><span>' + fmtMoeda(subtotalVal) + '</span></div>';

  if (dados.desconto > 0.005) {
    resumoHtml +=
      '<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px">'
      + '<span style="color:#e53935">Desconto</span>'
      + '<span style="color:#e53935">-' + fmtMoeda(dados.desconto) + '</span></div>';
  }

  resumoHtml +=
    '<div style="display:flex;justify-content:space-between;font-weight:700;font-size:15px;padding-top:10px;border-top:1px solid #ddd;margin-top:4px">'
    + '<span>Valor total</span><span>' + fmtMoeda(dados.total) + '</span></div>';

  // Pagamentos
  if (dados.pagamentos && dados.pagamentos.length > 0) {
    dados.pagamentos.forEach(function(p) {
      var nomeP    = nomePagamento(p.forma);
      var parc     = p.parcelas > 1 ? ' (' + p.parcelas + 'x)' : '';
      var repassar = p.taxa_modo === 'repassar' && p.taxa_valor > 0;
      var valorExib = repassar ? p.valor + p.taxa_valor : p.valor;
      resumoHtml +=
        '<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:13px">'
        + '<span style="color:#666">' + nomeP + parc + '</span>'
        + '<span style="font-weight:600">' + fmtMoeda(valorExib) + '</span></div>';
      if (repassar) {
        resumoHtml +=
          '<div style="display:flex;justify-content:space-between;margin-top:2px;font-size:11px">'
          + '<span style="color:#1565c0;padding-left:8px">&#8627; Taxa ' + p.taxa_pct + '%</span>'
          + '<span style="color:#1565c0">+' + fmtMoeda(p.taxa_valor) + '</span></div>';
      }
    });
    var totalPago = dados.pagamentos.reduce(function(s, p) { return s + p.valor; }, 0);
    var troco = Math.max(0, totalPago - dados.total);
    if (troco > 0.005) {
      resumoHtml +=
        '<div style="display:flex;justify-content:space-between;margin-top:4px;font-size:13px">'
        + '<span style="color:#666">Troco</span><span>' + fmtMoeda(troco) + '</span></div>';
    }
  }

  if (dados.vendedor) {
    resumoHtml +=
      '<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:13px">'
      + '<span style="color:#666">Vendedor</span>'
      + '<span style="font-weight:600">' + dados.vendedor + '</span></div>';
  }
  if (dados.cliente) {
    resumoHtml +=
      '<div style="display:flex;justify-content:space-between;margin-top:4px;font-size:13px">'
      + '<span style="color:#666">Cliente</span>'
      + '<span style="font-weight:600">' + dados.cliente + '</span></div>';
  }

  var tipoLabel = dados.tipo === 'orcamento' ? 'Orçamento' : 'Comprovante de venda';
  var dataHora  = dados.criado_em ? fmtData(dados.criado_em) : fmtData(new Date().toISOString());

  var logoHtml = cfg.logo_comprovante
    ? '<img src="' + cfg.logo_comprovante + '" style="width:68px;height:68px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 14px;border:2px solid rgba(255,255,255,.4)">'
    : '<div style="width:68px;height:68px;border-radius:50%;background:rgba(255,255,255,.18);border:2px solid rgba(255,255,255,.4);margin:0 auto 14px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;line-height:68px">' + inicial + '</div>';

  return '<div style="font-family:Arial,Helvetica,sans-serif;background:#ffffff;width:390px">'

    // Cabeçalho verde
    + '<div style="background:#1a3a2a;color:#ffffff;padding:28px 24px 22px;text-align:center">'
    +   logoHtml
    +   '<div style="font-size:17px;font-weight:700;margin-bottom:8px">' + nomeLoja + '</div>'
    +   headerInfo
    + '</div>'

    // Número + info
    + '<div style="text-align:center;padding:22px 20px 4px">'
    +   '<div style="font-weight:700;font-size:14px;color:#333">' + tipoLabel + ' ' + dados.numero + '</div>'
    +   (dados.vendedor && !dados.cliente ? '<div style="color:#888;font-size:13px;margin-top:4px">' + dados.vendedor + '</div>' : '')
    +   (dados.cliente ? '<div style="color:#888;font-size:13px;margin-top:4px">' + dados.cliente + '</div>' : '')
    + '</div>'

    // Total em destaque
    + '<div style="text-align:center;padding:10px 20px 20px">'
    +   '<div style="font-size:48px;font-weight:700;color:#111;letter-spacing:-1px;line-height:1.1">' + fmtMoeda(dados.total) + '</div>'
    + '</div>'

    // Lista de itens
    + '<div style="padding:0 16px 4px">' + itensHtml + '</div>'

    // Resumo financeiro
    + '<div style="margin:16px;background:#f5f5f5;border-radius:12px;padding:16px 18px">' + resumoHtml + '</div>'

    // Rodapé
    + '<div style="text-align:center;padding:8px 24px 6px;color:#888;font-style:italic;font-size:13px">' + rodape + '</div>'
    + '<div style="text-align:center;padding-bottom:24px;color:#bbb;font-size:12px">' + dataHora + '</div>'

    + '</div>';
}

// Captura o comprovante com html2canvas e abre o menu de compartilhamento
async function _compartilharComoImagem(dados, btnEl) {
  if (btnEl) btnLoading(btnEl, true);
  try {
    showToast('Gerando comprovante...', 'info');
    await _garantirHtml2Canvas();

    // Cria (ou reutiliza) o container fora da tela — precisa estar no DOM para o html2canvas renderizar
    var el = document.getElementById('_share_receipt_wrap');
    if (!el) {
      el = document.createElement('div');
      el.id = '_share_receipt_wrap';
      el.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;pointer-events:none;overflow:visible';
      document.body.appendChild(el);
    }
    el.innerHTML = _buildShareReceiptHtml(dados);

    // Aguarda imagens pintarem
    await new Promise(function(r) { setTimeout(r, 450); });

    var canvas = await html2canvas(el.firstElementChild, {
      useCORS: true,
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
    });

    el.innerHTML = ''; // limpa

    var dataUrl = canvas.toDataURL('image/png');
    var fileName = (dados.tipo === 'orcamento' ? 'orcamento-' : 'venda-') + dados.numero + '.png';
    var titulo = dados.tipo === 'orcamento' ? 'Orçamento' : 'Comprovante de Venda';
    var b64 = dataUrl.split(',')[1];

    var CapFS    = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Filesystem;
    var CapShare = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Share;

    // 1) Android nativo: salva em cache e compartilha URI real
    if (CapFS && CapShare) {
      try {
        var saved = await CapFS.writeFile({
          path: fileName,
          data: b64,
          directory: 'CACHE',
        });
        await CapShare.share({
          title: titulo,
          files: [saved.uri],
          dialogTitle: titulo,
        });
        await CapFS.deleteFile({ path: fileName, directory: 'CACHE' }).catch(function(){});
        return;
      } catch (e1) {
        // usuário fechou o menu → ok, não faz nada
        if (/cancel|abort|dismiss/i.test(e1.message || '') || e1.name === 'AbortError') return;
        // erro real → mostra overlay como fallback
      }
    }

    var blob = await new Promise(function(r) { canvas.toBlob(r, 'image/png'); });
    var file = new File([blob], fileName, { type: 'image/png' });

    // 2) navigator.share disponível (HTTPS): abre menu de compartilhamento direto
    if (navigator.share) {
      try {
        var shareData = { title: titulo };
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          shareData.files = [file];
        }
        await navigator.share(shareData);
        return;
      } catch (e2) {
        if (e2.name === 'AbortError') return; // usuário fechou → ok
        // Erro real → fallback download
      }
    }

    // 3) Fallback: download direto (browsers sem suporte ao navigator.share)
    var a = document.createElement('a');
    a.href = dataUrl; a.download = fileName;
    document.body.appendChild(a); a.click();
    setTimeout(function() { document.body.removeChild(a); }, 100);
    showToast('Comprovante salvo!', 'success');

  } catch(e) {
    if (e.name !== 'AbortError') showToast('Erro ao gerar comprovante: ' + (e.message || 'Tente novamente'), 'error');
  } finally {
    if (btnEl) btnLoading(btnEl, false);
  }
}

// Modal de compartilhamento com opções (WhatsApp, Download, Fechar)
// blob e titulo são opcionais — quando presentes, exibe botão "Compartilhar agora" (abre menu do Windows)
// Mostra overlay com botão que chama navigator.share direto no clique (gesto fresco)
function _mostrarBotaoShare(file, titulo, dataUrl, fileName) {
  var ov = document.getElementById('_share_btn_overlay');
  if (ov) ov.remove();
  ov = document.createElement('div');
  ov.id = '_share_btn_overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
  ov.innerHTML =
    '<div style="background:#fff;border-radius:16px;padding:28px 24px;max-width:340px;width:100%;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.4)">' +
      '<img src="' + dataUrl + '" style="max-width:100%;max-height:220px;border-radius:8px;margin-bottom:20px">' +
      '<button id="_share_now_btn" style="width:100%;background:#1a3a2a;color:#fff;border:none;border-radius:12px;padding:14px;font-size:16px;font-weight:700;cursor:pointer;margin-bottom:10px">' +
        '&#x1F4E4; Compartilhar' +
      '</button>' +
      '<button id="_share_close_btn" style="width:100%;background:#f0f0f0;color:#555;border:none;border-radius:12px;padding:12px;font-size:14px;cursor:pointer">' +
        'Fechar' +
      '</button>' +
    '</div>';
  document.body.appendChild(ov);
  document.getElementById('_share_now_btn').addEventListener('click', function() {
    navigator.share({ files: [file], title: titulo }).then(function() {
      ov.remove();
    }).catch(function(e) {
      if (e.name === 'AbortError') { ov.remove(); return; }
      var a = document.createElement('a');
      a.href = dataUrl; a.download = fileName;
      document.body.appendChild(a); a.click();
      setTimeout(function() { document.body.removeChild(a); }, 100);
      ov.remove();
    });
  });
  document.getElementById('_share_close_btn').addEventListener('click', function() { ov.remove(); });
}

function _mostrarModalShare(dataUrl, fileName, blob, titulo) {
  var ov = document.getElementById('_share_modal_overlay');
  if (ov) ov.remove();

  ov = document.createElement('div');
  ov.id = '_share_modal_overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';

  var podeSistema = blob && navigator.share;

  ov.innerHTML =
    '<div style="background:#fff;border-radius:16px;padding:24px;max-width:380px;width:100%;box-shadow:0 8px 40px rgba(0,0,0,.4);text-align:center">' +
      '<div style="font-weight:700;font-size:16px;color:#1a3a2a;margin-bottom:16px"><i class="bi bi-share-fill" style="margin-right:8px"></i>Compartilhar Comprovante</div>' +
      '<img src="' + dataUrl + '" style="max-width:100%;max-height:260px;border-radius:10px;margin-bottom:20px;box-shadow:0 2px 12px rgba(0,0,0,.15)">' +
      '<div style="display:flex;flex-direction:column;gap:10px">' +
        (podeSistema
          ? '<button id="_share_btn_sistema" style="background:#0078d4;color:#fff;border:none;border-radius:10px;padding:13px;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">' +
              '<i class="bi bi-share-fill"></i>Compartilhar agora' +
            '</button>'
          : '') +
        '<button id="_share_btn_wpp" style="background:#25D366;color:#fff;border:none;border-radius:10px;padding:12px;font-size:15px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">' +
          '<i class="bi bi-whatsapp"></i>Compartilhar no WhatsApp' +
        '</button>' +
        '<button id="_share_btn_dl" style="background:#1a3a2a;color:#fff;border:none;border-radius:10px;padding:12px;font-size:15px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">' +
          '<i class="bi bi-download"></i>Baixar Imagem' +
        '</button>' +
        '<button id="_share_btn_close" style="background:#f0f0f0;color:#333;border:none;border-radius:10px;padding:12px;font-size:15px;cursor:pointer">' +
          'Fechar' +
        '</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(ov);

  // Compartilhar agora → abre menu do sistema (Windows/Mac) com gesto fresco
  if (podeSistema) {
    document.getElementById('_share_btn_sistema').addEventListener('click', function() {
      var file = new File([blob], fileName, { type: 'image/png' });
      var shareData = { title: titulo || 'Comprovante' };
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        shareData.files = [file];
      }
      navigator.share(shareData)
        .then(function() { ov.remove(); })
        .catch(function(e) { if (e.name !== 'AbortError') showToast('Não foi possível abrir o menu de compartilhamento.', 'error'); });
    });
  }

  // Baixar
  document.getElementById('_share_btn_dl').addEventListener('click', function() {
    var a = document.createElement('a');
    a.href = dataUrl; a.download = fileName;
    document.body.appendChild(a); a.click();
    setTimeout(function() { document.body.removeChild(a); }, 100);
  });

  // WhatsApp — baixa a imagem e abre o WhatsApp Web
  document.getElementById('_share_btn_wpp').addEventListener('click', function() {
    var a = document.createElement('a');
    a.href = dataUrl; a.download = fileName;
    document.body.appendChild(a); a.click();
    setTimeout(function() {
      document.body.removeChild(a);
      window.open('https://web.whatsapp.com', '_blank');
    }, 400);
    showToast('Imagem salva! Anexe no WhatsApp que abriu.', 'info');
  });

  // Fechar
  document.getElementById('_share_btn_close').addEventListener('click', function() { ov.remove(); });
  ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
}

// Exibe a imagem do comprovante em overlay full-screen para salvar manualmente
function _mostrarImagemParaSalvar(dataUrl, fileName) {
  var ov = document.getElementById('_share_img_overlay');
  if (ov) ov.remove();

  ov = document.createElement('div');
  ov.id = '_share_img_overlay';
  ov.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:99999',
    'background:rgba(0,0,0,0.93)',
    'display:flex', 'flex-direction:column',
    'align-items:center', 'justify-content:center',
    'padding:16px', 'box-sizing:border-box',
  ].join(';');

  ov.innerHTML =
    '<p style="color:#fff;font-size:13px;margin:0 0 14px;opacity:0.75;text-align:center;">' +
      'Segure a imagem para salvar na galeria' +
    '</p>' +
    '<img id="_share_img_el" src="' + dataUrl + '" ' +
      'style="max-width:92vw;max-height:75vh;border-radius:10px;' +
             'box-shadow:0 4px 40px rgba(0,0,0,0.6);display:block;" />' +
    '<button id="_share_img_close" ' +
      'style="margin-top:22px;padding:11px 36px;background:#ffffff;border:none;' +
             'border-radius:24px;font-size:15px;font-weight:600;cursor:pointer;' +
             'color:#1a3a2a;letter-spacing:.3px;">' +
      'Fechar' +
    '</button>';

  document.body.appendChild(ov);
  document.getElementById('_share_img_close').addEventListener('click', function() { ov.remove(); });
}
