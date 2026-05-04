// URL do servidor — configurável por dispositivo (armazenado no localStorage)
// No modo cloud (browser normal), usa o próprio origin. No Capacitor/app, usa o URL configurado.
function getApiBase() {
  // Modo antigo on-premise: protocolo capacitor:// com URL manual
  if (window.location.protocol === 'capacitor:') {
    const saved = localStorage.getItem('pdv_server_url');
    return (saved || 'http://127.0.0.1:8000') + '/api';
  }
  // Modo cloud (browser ou Capacitor apontando para https://): usa origin
  return window.location.origin + '/api';
}
function setApiUrl(url) {
  // Remove barra no final e salva
  localStorage.setItem('pdv_server_url', url.replace(/\/+$/, ''));
  sessionStorage.removeItem('config_loja');
}

// Retorna o subdomínio salvo (modo app) para o header X-Tenant
function getTenant() {
  return localStorage.getItem('pdv_subdominio') || null;
}

// JWT helpers
function getAuthToken() {
  return localStorage.getItem('pdv_token') || sessionStorage.getItem('pdv_token') || null;
}
function setAuthToken(token) {
  if (token) { localStorage.setItem('pdv_token', token); sessionStorage.setItem('pdv_token', token); }
  else { localStorage.removeItem('pdv_token'); sessionStorage.removeItem('pdv_token'); }
}

// Refresh token helpers
function getRefreshToken() {
  return localStorage.getItem('pdv_refresh_token') || null;
}
function setRefreshToken(token) {
  if (token) localStorage.setItem('pdv_refresh_token', token);
  else localStorage.removeItem('pdv_refresh_token');
}

// Tenta renovar o access token silenciosamente usando o refresh token
async function _tryRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const tenant = getTenant();
    const headers = { 'Content-Type': 'application/json' };
    if (tenant) headers['X-Tenant'] = tenant;
    const res = await fetch(getApiBase() + '/vendedores/refresh', {
      method: 'POST',
      headers,
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setAuthToken(data.token);
    if (data.refresh_token) setRefreshToken(data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

async function apiFetch(path, options = {}, _retry = false) {
  const tenant = getTenant();
  const token  = getAuthToken();
  const extraHeaders = {};
  if (tenant) extraHeaders['X-Tenant'] = tenant;
  if (token)  extraHeaders['Authorization'] = 'Bearer ' + token;
  try {
    const res = await fetch(getApiBase() + path, {
      headers: { 'Content-Type': 'application/json', ...extraHeaders, ...options.headers },
      ...options,
    });

    // Token expirado — tenta renovar automaticamente (só uma vez)
    if (res.status === 401 && !_retry) {
      const renovado = await _tryRefresh();
      if (renovado) return apiFetch(path, options, true);
      // Refresh falhou → redireciona para login
      setAuthToken(null);
      setRefreshToken(null);
      const loginUrl = typeof getLoginUrl === 'function' ? getLoginUrl() : '/login-app';
      window.location.href = loginUrl;
      return null;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Erro desconhecido' }));
      // 503 com flag _offline = SW interceptou por queda de rede
      if (res.status === 503 && err && err._offline) {
        if (window.OfflinePDV && OfflinePDV.marcarOffline) OfflinePDV.marcarOffline();
        throw new Error('Sem conexão com o servidor');
      }
      throw new Error(err.detail || `Erro ${res.status}`);
    }
    // Sucesso real → garante que estado é "online"
    if (window.OfflinePDV && OfflinePDV.marcarOnline) OfflinePDV.marcarOnline();
    if (res.status === 204) return null;
    return await res.json();
  } catch (e) {
    if (e instanceof TypeError) {
      if (window.OfflinePDV && OfflinePDV.marcarOffline) OfflinePDV.marcarOffline();
      throw new Error('Servidor offline. Verifique se o PDV está rodando.');
    }
    throw e;
  }
}

const api = {
  // Vendedores
  vendedores: {
    listar: () => apiFetch('/vendedores/'),
    criar: (d) => apiFetch('/vendedores/', { method: 'POST', body: JSON.stringify(d) }),
    atualizar: (id, d) => apiFetch(`/vendedores/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    deletar: (id) => apiFetch(`/vendedores/${id}`, { method: 'DELETE' }),
    login: (nome, senha) => apiFetch('/vendedores/login', { method: 'POST', body: JSON.stringify({ nome, senha }) }),
    atualizarPermissoes: (id, d) => apiFetch(`/vendedores/${id}/permissoes`, { method: 'PUT', body: JSON.stringify(d) }),
  },

  // Clientes
  clientes: {
    listar: (busca = '') => apiFetch(`/clientes/${busca ? '?busca=' + encodeURIComponent(busca) : ''}`),
    criar: (d) => apiFetch('/clientes/', { method: 'POST', body: JSON.stringify(d) }),
    buscar: (id) => apiFetch(`/clientes/${id}`),
    atualizar: (id, d) => apiFetch(`/clientes/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    deletar: (id) => apiFetch(`/clientes/${id}`, { method: 'DELETE' }),
    extratoFiado: (id) => apiFetch(`/clientes/${id}/extrato-fiado`),
    pagarFiado: (id, d) => apiFetch(`/clientes/${id}/pagar-fiado`, { method: 'POST', body: JSON.stringify(d) }),
    cancelarMovimento: (clienteId, movId) => apiFetch(`/clientes/${clienteId}/movimentos/${movId}/cancelar`, { method: 'POST' }),
  },

  // Categorias
  categorias: {
    listar: () => apiFetch('/categorias/'),
    criar: (d) => apiFetch('/categorias/', { method: 'POST', body: JSON.stringify(d) }),
    atualizar: (id, d) => apiFetch(`/categorias/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    deletar: (id) => apiFetch(`/categorias/${id}`, { method: 'DELETE' }),
  },

  // Produtos
  produtos: {
    listar: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiFetch(`/produtos/${q ? '?' + q : ''}`);
    },
    criar: (d) => apiFetch('/produtos/', { method: 'POST', body: JSON.stringify(d) }),
    buscar: (id) => apiFetch(`/produtos/${id}`),
    barcode: (codigo) => apiFetch(`/produtos/barcode/${encodeURIComponent(codigo)}`),
    atualizar: (id, d) => apiFetch(`/produtos/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    arquivar: (id) => apiFetch(`/produtos/${id}/arquivar`, { method: 'PUT' }),
    desarquivar: (id) => apiFetch(`/produtos/${id}/desarquivar`, { method: 'PUT' }),
    deletar: (id) => apiFetch(`/produtos/${id}`, { method: 'DELETE' }),
  },

  // Vendas
  vendas: {
    listar: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiFetch(`/vendas/${q ? '?' + q : ''}`);
    },
    criar: (d) => apiFetch('/vendas/', { method: 'POST', body: JSON.stringify(d) }),
    buscar: (id) => apiFetch(`/vendas/${id}`),
    cancelar: (id, vendedor_id) => apiFetch(`/vendas/${id}/cancelar?vendedor_id=${vendedor_id}`, { method: 'PUT' }),
  },

  // Estoque
  estoque: {
    movimentos: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiFetch(`/estoque/movimentos${q ? '?' + q : ''}`);
    },
    resumoMovimentos: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiFetch(`/estoque/movimentos/resumo${q ? '?' + q : ''}`);
    },
    alertas: () => apiFetch('/estoque/alertas'),
    entrada: (d) => apiFetch('/estoque/entrada', { method: 'POST', body: JSON.stringify(d) }),
    ajuste:  (d) => apiFetch('/estoque/ajuste',  { method: 'POST', body: JSON.stringify(d) }),
    saida:   (d) => apiFetch('/estoque/saida',   { method: 'POST', body: JSON.stringify(d) }),
  },

  // Relatórios
  relatorios: {
    resumoDia: (data) => apiFetch(`/relatorios/resumo-dia${data ? '?data=' + data : ''}`),
    vendasPeriodo: (p = {}) => apiFetch(`/relatorios/vendas-periodo?${new URLSearchParams(p)}`),
    formasPagamento: (p = {}) => apiFetch(`/relatorios/formas-pagamento?${new URLSearchParams(p)}`),
    maisVendidos: (p = {}) => apiFetch(`/relatorios/produtos-mais-vendidos?${new URLSearchParams(p)}`),
    desempenho: (p = {}) => apiFetch(`/relatorios/vendedor-desempenho?${new URLSearchParams(p)}`),
    valorEstoque: () => apiFetch('/relatorios/valor-estoque'),
    vendasDiariasProdutos: (p = {}) => apiFetch(`/relatorios/vendas-diarias-produtos?${new URLSearchParams(p)}`),
    comparativoProdutos: (p = {}) => apiFetch(`/relatorios/comparativo-produtos?${new URLSearchParams(p)}`),
    produtosSemGiro: (dias = 30) => apiFetch(`/relatorios/produtos-sem-giro?dias=${dias}`),
  },

  // Empresa (master)
  empresas: {
    minha:             () => apiFetch('/empresas/minha'),
    atualizarModulos:  (modulos) => apiFetch('/empresas/minha/modulos', { method: 'PUT', body: JSON.stringify({ modulos }) }),
  },

  // Configurações da loja
  configuracoes: {
    listar: () => apiFetch('/configuracoes/'),
    atualizar: (d) => apiFetch('/configuracoes/', { method: 'PUT', body: JSON.stringify(d) }),
  },

  // Impressão WiFi (ESC/POS via TCP)
  impressao: {
    imprimir: (d) => apiFetch('/impressao/wifi', { method: 'POST', body: JSON.stringify(d) }),
  },

  // Orçamentos
  orcamentos: {
    listar: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiFetch(`/orcamentos/${q ? '?' + q : ''}`);
    },
    criar: (d) => apiFetch('/orcamentos/', { method: 'POST', body: JSON.stringify(d) }),
    buscar: (id) => apiFetch(`/orcamentos/${id}`),
    atualizar: (id, d) => apiFetch(`/orcamentos/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    deletar: (id) => apiFetch(`/orcamentos/${id}`, { method: 'DELETE' }),
  },

  // Comissões
  comissoes: {
    listar:    (p) => apiFetch('/comissoes/?' + new URLSearchParams(p || {})),
    resumo:    (p) => apiFetch('/comissoes/resumo?' + new URLSearchParams(p || {})),
    minha:     () => apiFetch('/comissoes/minha'),
    pagar:     (id) => apiFetch(`/comissoes/${id}/pagar`, { method: 'PUT' }),
    pagarLote: (vendedor_id) => apiFetch(`/comissoes/pagar-lote?vendedor_id=${vendedor_id}`, { method: 'PUT' }),
  },

  // Mesas
  mesas: {
    listar:       () => apiFetch('/mesas/'),
    criar:        (d) => apiFetch('/mesas/', { method: 'POST', body: JSON.stringify(d) }),
    buscar:       (id) => apiFetch(`/mesas/${id}`),
    atualizar:    (id, d) => apiFetch(`/mesas/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    deletar:      (id) => apiFetch(`/mesas/${id}`, { method: 'DELETE' }),
    abrirComanda: (id, d) => apiFetch(`/mesas/${id}/abrir`, { method: 'POST', body: JSON.stringify(d) }),
    comanda:      (id) => apiFetch(`/mesas/${id}/comanda`),
    addItem:      (id, d) => apiFetch(`/mesas/${id}/item`, { method: 'POST', body: JSON.stringify(d) }),
    editarItem:   (id, iid, d) => apiFetch(`/mesas/${id}/item/${iid}`, { method: 'PUT', body: JSON.stringify(d) }),
    removerItem:  (id, iid) => apiFetch(`/mesas/${id}/item/${iid}`, { method: 'DELETE' }),
    fechar:       (id, d) => apiFetch(`/mesas/${id}/fechar`, { method: 'PUT', body: JSON.stringify(d) }),
    cancelar:     (id) => apiFetch(`/mesas/${id}/cancelar`, { method: 'PUT' }),
    transferir:   (id, d) => apiFetch(`/mesas/${id}/transferir`, { method: 'PUT', body: JSON.stringify(d) }),
    juntar:       (id, d) => apiFetch(`/mesas/${id}/juntar`, { method: 'PUT', body: JSON.stringify(d) }),
    dashboard:    (p = {}) => apiFetch('/mesas/dashboard' + (p.inicio || p.fim ? `?inicio=${p.inicio||''}&fim=${p.fim||''}` : '')),
    alterarStatus: (id, status, extra = {}) => apiFetch(`/mesas/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, ...extra }) }),
  },

  // Caixa Sessão
  caixa: {
    status:     (vendedor_id) => apiFetch(`/caixa/status?vendedor_id=${vendedor_id}`),
    abrir:      (d) => apiFetch('/caixa/abrir',      { method: 'POST', body: JSON.stringify(d) }),
    fechar:     (d) => apiFetch('/caixa/fechar',     { method: 'POST', body: JSON.stringify(d) }),
    movimento:  (d) => apiFetch('/caixa/movimentos', { method: 'POST', body: JSON.stringify(d) }),
    movimentos: (sessao_id) => apiFetch(`/caixa/movimentos/${sessao_id}`),
    resumo:     (sessao_id) => apiFetch(`/caixa/resumo/${sessao_id}`),
    historico:  () => apiFetch('/caixa/historico'),
  },
};
