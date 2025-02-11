function convertVmess(input) {
  try {
    const data = JSON.parse(atob(input.replace('vmess://', '')));
    if (!data.add || !data.port || !data.id) return null;
    let streamSettings = {};
    if (data.net === 'ws' || data.net === 'h2') {
      streamSettings = { network: data.net, wsSettings: {} };
      if (data.path) streamSettings.wsSettings.path = data.path;
      if (data.host) streamSettings.wsSettings.headers = { Host: data.host };
    } else {
      streamSettings = { network: data.net };
    }
    return {
      type: "vmess",
      tag: `vmess-${generateUUID().slice(0,8)}`,
      server: data.add,
      server_port: parseInt(data.port),
      uuid: data.id,
      security: data.scy || "auto",
      streamSettings: streamSettings,
      tls: { enabled: data.tls === 'tls', server_name: data.sni || data.add, insecure: true }
    };
  } catch (error) {
    throw new Error('Invalid VMess configuration');
  }
}
function convertVless(input) {
  try {
    const url = new URL(input);
    if (url.protocol.toLowerCase() !== 'vless:' || !url.hostname) return null;
    const address = url.hostname;
    const port = url.port || 443;
    const params = new URLSearchParams(url.search);
    let streamSettings = {};
    if (params.get('type') === 'ws') {
      streamSettings = { network: 'ws', wsSettings: {} };
      if (params.get('path')) streamSettings.wsSettings.path = params.get('path');
      if (params.get('host')) streamSettings.wsSettings.headers = { Host: params.get('host') };
    } else {
      streamSettings = { network: params.get('type') || 'tcp' };
    }
    return {
      type: "vless",
      tag: `vless-${generateUUID().slice(0,8)}`,
      server: address,
      server_port: parseInt(port),
      uuid: url.username,
      flow: params.get('flow') || "",
      streamSettings: streamSettings,
      tls: { enabled: true, server_name: params.get('sni') || address, insecure: true, alpn: (params.get('alpn')||'').split(',').filter(Boolean) }
    };
  } catch (error) {
    throw new Error('Invalid VLESS configuration');
  }
}
function convertTrojan(input) {
  try {
    const url = new URL(input);
    if (url.protocol.toLowerCase() !== 'trojan:' || !url.hostname) return null;
    const params = new URLSearchParams(url.search);
    let streamSettings = {};
    if (params.get('type') && params.get('type') !== 'tcp' && params.get('path')) {
      streamSettings = { network: params.get('type'), wsSettings: { path: params.get('path') } };
    } else {
      streamSettings = { network: 'tcp' };
    }
    return {
      type: "trojan",
      tag: `trojan-${generateUUID().slice(0,8)}`,
      server: url.hostname,
      server_port: parseInt(url.port || 443),
      password: url.username,
      streamSettings: streamSettings,
      tls: { enabled: true, server_name: params.get('sni') || url.hostname, insecure: true, alpn: (params.get('alpn')||'').split(',').filter(Boolean) }
    };
  } catch (error) {
    throw new Error('Invalid Trojan configuration');
  }
}
function convertHysteria2(input) {
  try {
    const url = new URL(input);
    if (!['hysteria2:', 'hy2:'].includes(url.protocol.toLowerCase()) || !url.hostname || !url.port) return null;
    const params = new URLSearchParams(url.search);
    return {
      type: "hysteria2",
      tag: `hysteria2-${generateUUID().slice(0,8)}`,
      server: url.hostname,
      server_port: parseInt(url.port),
      password: url.username || params.get('password') || "",
      streamSettings: { network: "udp" },
      tls: { enabled: true, server_name: params.get('sni') || url.hostname, insecure: true }
    };
  } catch (error) {
    throw new Error('Invalid Hysteria2 configuration');
  }
}
function convertShadowsocks(input) {
  try {
    const ss = input.replace('ss://', '');
    const [serverPart, _] = ss.split('#');
    const [methodAndPass, serverAndPort] = serverPart.split('@');
    const [cipher, password] = atob(methodAndPass).split(':');
    const [server, port] = serverAndPort.split(':');
    if (!server || !port) return null;
    return {
      type: "shadowsocks",
      tag: `ss-${generateUUID().slice(0,8)}`,
      server: server,
      server_port: parseInt(port),
      cipher: cipher,
      password: password
    };
  } catch (error) {
    throw new Error('Invalid Shadowsocks configuration');
  }
}
function convertWireguard(input) {
  try {
    const stripped = input.replace('wg://', '');
    const params = new URLSearchParams(stripped);
    const server = params.get('server');
    const port = params.get('port') || 51820;
    const privateKey = params.get('privateKey');
    const publicKey = params.get('publicKey');
    if (!server || !privateKey || !publicKey) return null;
    return {
      type: "wireguard",
      tag: `wg-${generateUUID().slice(0,8)}`,
      server: server,
      server_port: parseInt(port),
      privateKey: privateKey,
      publicKey: publicKey,
      allowedIPs: params.get('allowedIPs') ? params.get('allowedIPs').split(',') : ["0.0.0.0/0"]
    };
  } catch (error) {
    throw new Error('Invalid WireGuard configuration');
  }
}