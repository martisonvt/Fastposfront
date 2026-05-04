/**
 * offline.js — modo offline para o Caixa/PDV
 *
 * Responsabilidades:
 *   1. Detectar conectividade real (ping, não navigator.onLine)
 *   2. Cache de produtos e clientes no IndexedDB
 *   3. Fila de vendas pendentes quando offline
 *   4. Sync automático ao reconectar (idempotência via client_uuid)
 */

(function () {
  'use strict';

  // ── IndexedDB setup ────────────────────────────────────────────────────────
  const DB_NAME    = 'fastpos_offline';
  const DB_VERSION = 3; // v3: adiciona mesas
  let _db = null;

  function _openDB() {
    return new Promise((resolve, reject) => {
      if (_db) return resolve(_db);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('produtos')) {
          db.createObjectStore('produtos', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('clientes')) {
          db.createObjectStore('clientes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('vendedores')) {
          db.createObjectStore('vendedores', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('categorias')) {
          db.createObjectStore('categorias', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('fila_vendas')) {
          const store = db.createObjectStore('fila_vendas', { keyPath: 'client_uuid' });
          store.createIndex('criado_em', 'criado_em', { unique: false });
        }
        if (!db.objectStoreNames.contains('mesas')) {
          db.createObjectStore('mesas', { keyPath: 'id' });
        }
      };
      req.onsuccess  = function (e) { _db = e.target.result; resolve(_db); };
      req.onerror    = function (e) { reject(e.target.error); };
    });
  }

  function _tx(store, mode, fn) {
    return _openDB().then(db => new Promise((resolve, reject) => {
      const tx  = db.transaction(store, mode);
      const obj = tx.objectStore(store);
      const req = fn(obj);
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror   = function (e) { reject(e.target.error); };
    }));
  }

  function _getAll(store) {
    return _openDB().then(db => new Promise((resolve, reject) => {
      const tx  = db.transaction(store, 'readonly');
      const obj = tx.objectStore(store);
      const req = obj.getAll();
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror   = function (e) { reject(e.target.error); };
    }));
  }

  function _putAll(store, items) {
    return _openDB().then(db => new Promise((resolve, reject) => {
      const tx  = db.transaction(store, 'readwrite');
      const obj = tx.objectStore(store);
      items.forEach(item => obj.put(item));
      tx.oncomplete = resolve;
      tx.onerror    = function (e) { reject(e.target.error); };
    }));
  }

  function _clearStore(store) {
    return _openDB().then(db => new Promise((resolve, reject) => {
      const tx  = db.transaction(store, 'readwrite');
      const obj = tx.objectStore(store);
      const req = obj.clear();
      req.onsuccess = resolve;
      req.onerror   = function (e) { reject(e.target.error); };
    }));
  }

  // ── UUID v4 simples ────────────────────────────────────────────────────────
  function _uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  // ── Detecção real de conectividade ─────────────────────────────────────────
  // navigator.onLine é falso positivo em Wi-Fi sem internet. Usamos ping real.
  let _offlineState = true; // começa pessimista; ping confirma

  // Helpers que reutilizam funções globais do api.js para auth + tenant.
  // CRÍTICO: sem isso o backend retorna 401 e o cache nunca popula.
  function _apiBase() {
    return (typeof getApiBase === 'function') ? getApiBase() : '/api';
  }
  function _apiHeaders() {
    const h = { 'Content-Type': 'application/json' };
    try {
      const tok = (typeof getAuthToken === 'function') ? getAuthToken() : null;
      const ten = (typeof getTenant === 'function') ? getTenant() : null;
      if (tok) h['Authorization'] = 'Bearer ' + tok;
      if (ten) h['X-Tenant'] = ten;
    } catch(_) {}
    return h;
  }

  async function _ping() {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch(_apiBase() + '/produtos/?limite=1', {
        signal: ctrl.signal,
        cache: 'no-store',
        headers: _apiHeaders(),
      });
      clearTimeout(timer);
      // 503 do SW = offline real; 401/403 = autenticação, mas servidor RESPONDEU → online
      if (r.status === 503) return false;
      return true;
    } catch (_) {
      return false;
    }
  }

  async function _verificarConectividade() {
    const online = await _ping();
    const eraOffline = _offlineState;
    _offlineState = !online;

    if (eraOffline && online) {
      // Voltou a conexão
      await sincronizar();
      _cachearProdutos();
      _cachearClientes();
      _cachearVendedores();
      _cachearCategorias();
      _cachearMesas();
    }

    const qtd = await _contarFila();
    _atualizarBanner(!_offlineState, qtd);
    return online;
  }

  // ── Banner offline ─────────────────────────────────────────────────────────
  // Empurra o body para baixo em vez de cobrir; usa altura compacta.
  const BANNER_H = 32; // px

  function _criarBanner() {
    if (document.getElementById('offline-banner')) return;
    const div = document.createElement('div');
    div.id = 'offline-banner';
    div.innerHTML = `
      <i class="bi bi-wifi-off"></i>
      <span id="offline-banner-msg" style="margin-left:6px">Modo offline</span>
      <span id="offline-banner-fila" style="margin-left:8px;background:#fff3cd;color:#664d03;padding:1px 6px;border-radius:8px;font-size:.7rem;display:none"></span>
    `;
    Object.assign(div.style, {
      position:   'fixed',
      top:        '0',
      left:       '0',
      right:      '0',
      height:     BANNER_H + 'px',
      lineHeight: BANNER_H + 'px',
      zIndex:     '9999',
      background: '#e65100',
      color:      '#fff',
      textAlign:  'center',
      fontSize:   '0.78rem',
      fontWeight: '600',
      display:    'none',
      whiteSpace: 'nowrap',
      overflow:   'hidden',
    });
    document.body.prepend(div);
  }

  function _setBodyOffset(visible) {
    const v = visible ? (BANNER_H + 'px') : '';
    document.body.style.paddingTop = v;
    document.documentElement.style.scrollPaddingTop = v;
    // CSS variable para elementos position:fixed (ex: hamburger #sidebar-toggle)
    document.documentElement.style.setProperty('--banner-h', visible ? (BANNER_H + 'px') : '0px');
  }

  function _atualizarBanner(online, qtdFila) {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;
    const msgEl  = document.getElementById('offline-banner-msg');
    const filaEl = document.getElementById('offline-banner-fila');

    if (!online) {
      banner.style.display = 'block';
      banner.style.background = '#e65100';
      banner.style.cursor = 'default';
      banner.onclick = null;
      msgEl.textContent = 'Modo offline';
      if (qtdFila > 0) {
        filaEl.style.display = 'inline-block';
        filaEl.textContent = qtdFila + ' pendente' + (qtdFila > 1 ? 's' : '');
      } else {
        filaEl.style.display = 'none';
      }
      _setBodyOffset(true);
    } else if (qtdFila > 0) {
      banner.style.display = 'block';
      banner.style.cursor = 'pointer';
      banner.onclick = () => sincronizar();
      if (_sincronizando) {
        banner.style.background = '#1565c0';
        msgEl.textContent = 'Sincronizando ' + qtdFila + ' venda' + (qtdFila > 1 ? 's' : '') + '...';
      } else {
        banner.style.background = '#f59f00';
        msgEl.textContent = qtdFila + ' venda' + (qtdFila > 1 ? 's' : '') + ' pendente' + (qtdFila > 1 ? 's' : '') + ' — tocar para sincronizar';
      }
      filaEl.style.display = 'none';
      _setBodyOffset(true);
    } else {
      banner.style.display = 'none';
      banner.onclick = null;
      _setBodyOffset(false);
    }
  }

  // ── Cache de produtos, clientes e vendedores ──────────────────────────────
  async function _cachearProdutos() {
    try {
      const res = await fetch(_apiBase() + '/produtos/?limite=500&ativo=true', {
        signal: AbortSignal.timeout(8000),
        headers: _apiHeaders(),
      });
      if (!res.ok) return;
      const lista = await res.json();
      if (!Array.isArray(lista) || !lista.length) return;
      await _clearStore('produtos');
      await _putAll('produtos', lista);
    } catch (_) {}
  }

  async function _cachearClientes() {
    try {
      const res = await fetch(_apiBase() + '/clientes/?limite=500', {
        signal: AbortSignal.timeout(8000),
        headers: _apiHeaders(),
      });
      if (!res.ok) return;
      const lista = await res.json();
      if (!Array.isArray(lista)) return;
      await _clearStore('clientes');
      await _putAll('clientes', lista);
    } catch (_) {}
  }

  async function _cachearVendedores() {
    try {
      const res = await fetch(_apiBase() + '/vendedores/', {
        signal: AbortSignal.timeout(8000),
        headers: _apiHeaders(),
      });
      if (!res.ok) return;
      const lista = await res.json();
      if (!Array.isArray(lista) || !lista.length) return;
      await _clearStore('vendedores');
      await _putAll('vendedores', lista);
    } catch (_) {}
  }

  async function _cachearMesas() {
    try {
      const res = await fetch(_apiBase() + '/mesas/', {
        signal: AbortSignal.timeout(8000),
        headers: _apiHeaders(),
      });
      if (!res.ok) return;
      const lista = await res.json();
      if (!Array.isArray(lista) || !lista.length) return;
      await _clearStore('mesas');
      await _putAll('mesas', lista);
    } catch (_) {}
  }

  async function _cachearCategorias() {
    try {
      const res = await fetch(_apiBase() + '/categorias/', {
        signal: AbortSignal.timeout(8000),
        headers: _apiHeaders(),
      });
      if (!res.ok) return;
      const lista = await res.json();
      if (!Array.isArray(lista)) return;
      await _clearStore('categorias');
      await _putAll('categorias', lista);
    } catch (_) {}
  }

  function _ordenarPorNome(arr) {
    return (arr || []).slice().sort((a, b) =>
      (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' })
    );
  }

  async function getProdutosCache() {
    return _ordenarPorNome(await _getAll('produtos'));
  }

  async function getClientesCache() {
    return _ordenarPorNome(await _getAll('clientes'));
  }

  async function getVendedoresCache() {
    return _ordenarPorNome(await _getAll('vendedores'));
  }

  async function getCategoriasCache() {
    return _ordenarPorNome(await _getAll('categorias'));
  }

  async function getMesasCache() {
    const todas = await _getAll('mesas');
    return todas.slice().sort((a, b) => (a.numero_mesa || 0) - (b.numero_mesa || 0));
  }

  // Salva qualquer lista no cache imediatamente (chamado pela página quando
  // carrega dados da API com sucesso — garante cache sem depender do timing
  // do _cachear* em background).
  async function salvarCache(storeName, lista) {
    if (!Array.isArray(lista)) return;
    try {
      await _openDB();
      // Verifica se o store existe (defensivo: se DB upgrade não rolou, evita crash)
      if (!_db.objectStoreNames.contains(storeName)) return;
      if (lista.length === 0) return;
      await _clearStore(storeName);
      await _putAll(storeName, lista);
    } catch (_) {}
  }

  // Diagnóstico — permite o usuário rodar OfflinePDV.debug() no console
  async function debug() {
    const out = { offline: _offlineState };
    try {
      out.produtos    = (await _getAll('produtos')).length;
      out.clientes    = (await _getAll('clientes')).length;
      out.vendedores  = (await _getAll('vendedores')).length;
      out.categorias  = (await _getAll('categorias')).length;
      out.mesas       = (await _getAll('mesas')).length;
      out.fila_vendas = (await _getAll('fila_vendas')).length;
    } catch(e) { out.error = e.message; }
    console.log('[OfflinePDV]', out);
    return out;
  }

  // ── Fila de vendas ─────────────────────────────────────────────────────────
  async function enfileirarVenda(payload) {
    const uuid  = _uuid();
    const entry = Object.assign({}, payload, {
      client_uuid:             uuid,
      forcar_estoque_negativo: true,
      criado_em:               new Date().toISOString(),
    });
    await _tx('fila_vendas', 'readwrite', store => store.put(entry));
    await _atualizarContadorFila();
    return entry;
  }

  async function _contarFila() {
    const fila = await _getAll('fila_vendas');
    return fila.length;
  }

  async function _atualizarContadorFila() {
    const qtd = await _contarFila();
    _atualizarBanner(!_offlineState, qtd);
  }

  // ── Sincronização ──────────────────────────────────────────────────────────
  let _sincronizando = false;

  async function sincronizar() {
    if (_sincronizando) return;
    const fila = await _getAll('fila_vendas');
    if (!fila.length) return;

    _sincronizando = true;
    _atualizarBanner(true, fila.length);

    let erros = 0;
    for (const entry of fila) {
      try {
        const res = await fetch(_apiBase() + '/vendas/', {
          method:  'POST',
          headers: _apiHeaders(),
          body:    JSON.stringify(entry),
          signal:  AbortSignal.timeout(15000),
        });
        if (res.ok || res.status === 409) {
          await _tx('fila_vendas', 'readwrite', store => store.delete(entry.client_uuid));
        } else if (res.status === 401 || res.status === 403) {
          // Sessão expirada — não adianta insistir, sai para sync futura após login
          erros++;
          break;
        } else {
          erros++;
        }
      } catch (_) {
        erros++;
        break;
      }
    }

    _sincronizando = false;
    const restantes = await _contarFila();
    _atualizarBanner(!_offlineState, restantes);

    if (restantes === 0 && erros === 0 && typeof showToast === 'function') {
      showToast('Vendas offline sincronizadas!', 'success');
    }

    // Se houve erro mas estamos online, tenta novamente em 10s
    if (restantes > 0 && erros > 0 && !_offlineState) {
      setTimeout(() => sincronizar(), 10000);
    }
  }

  // ── Listeners de rede ──────────────────────────────────────────────────────
  window.addEventListener('online',  () => _verificarConectividade());
  window.addEventListener('offline', async () => {
    _offlineState = true;
    _atualizarBanner(false, await _contarFila());
  });

  // Verifica conectividade a cada 15s (detecta queda/volta sem evento de rede)
  setInterval(_verificarConectividade, 15000);

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    await _openDB();
    _criarBanner();

    // Detecta estado real de conexão
    const online = await _ping();
    _offlineState = !online;
    const qtd = await _contarFila();
    _atualizarBanner(online, qtd);

    if (online) {
      _cachearProdutos();
      _cachearClientes();
      _cachearVendedores();
      _cachearCategorias();
      _cachearMesas();
      if (qtd > 0) sincronizar();
    }
  }

  // ── Marcação imediata (chamada pelo api.js) ───────────────────────────────
  async function marcarOffline() {
    if (!_offlineState) {
      _offlineState = true;
      const qtd = await _contarFila();
      _atualizarBanner(false, qtd);
    }
  }

  async function marcarOnline() {
    if (_offlineState) {
      _offlineState = false;
      const qtd = await _contarFila();
      _atualizarBanner(true, qtd);
      // Volta da queda — sincroniza fila e atualiza cache
      sincronizar();
      _cachearProdutos();
      _cachearClientes();
      _cachearVendedores();
      _cachearCategorias();
      _cachearMesas();
    }
  }

  // ── API pública ───────────────────────────────────────────────────────────
  window.OfflinePDV = {
    init,
    enfileirarVenda,
    sincronizar,
    getProdutosCache,
    getClientesCache,
    getVendedoresCache,
    getCategoriasCache,
    getMesasCache,
    salvarCache,
    debug,
    isOffline: () => _offlineState,
    marcarOffline,
    marcarOnline,
    notificarErroAPI: marcarOffline,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
