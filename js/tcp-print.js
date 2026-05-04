/**
 * TcpPrint — Bridge para impressão térmica ESC/POS
 * Android (APK): usa plugin Capacitor nativo → TCP direto para a impressora
 * PC/Browser:    usa API do servidor (servidor faz o TCP — mesma rede necessária)
 */
const TcpPrint = (() => {
  function isAndroidNative() {
    return !!(window.Capacitor &&
              typeof window.Capacitor.isNativePlatform === 'function' &&
              window.Capacitor.isNativePlatform());
  }

  async function _gerarBytes(texto) {
    return apiFetch('/impressao/gerar-bytes', {
      method: 'POST',
      body: JSON.stringify({ texto }),
    });
  }

  async function imprimir(texto) {
    const ip    = localStorage.getItem('impressora_ip')    || '';
    const porta = parseInt(localStorage.getItem('impressora_porta') || '9100');
    if (!ip) throw new Error('IP da impressora não configurado. Acesse Impressora no menu.');

    if (isAndroidNative()) {
      const { base64 } = await _gerarBytes(texto);
      const { TcpPrint: Plugin } = Capacitor.Plugins;
      await Plugin.send({ host: ip, port: porta, data: base64 });
    } else {
      await api.impressao.imprimir({ ip, porta, texto });
    }
  }

  async function testarConexao(ip, porta) {
    porta = porta || 9100;
    if (isAndroidNative()) {
      const { base64 } = await _gerarBytes('');
      const { TcpPrint: Plugin } = Capacitor.Plugins;
      await Plugin.send({ host: ip, port: porta, data: base64 });
    } else {
      await api.impressao.imprimir({ ip, porta, texto: '' });
    }
  }

  return { imprimir, testarConexao, isAndroidNative };
})();
