function convertConfig() {
  const input = document.getElementById('input').value.trim();
  const errorDiv = document.getElementById('error');
  if (!input) {
    errorDiv.textContent = 'Please enter proxy configurations';
    return;
  }
  startLoading();
  setTimeout(() => {
    try {
      const configs = input.split('\n').filter(line => line.trim() && !line.trim().startsWith('//'));
      const outbounds = [];
      const validTags = [];
      for (const config of configs) {
        let converted;
        if (config.startsWith('vmess://')) {
          converted = convertVmess(config);
        } else if (config.startsWith('vless://')) {
          converted = convertVless(config);
        } else if (config.startsWith('trojan://')) {
          converted = convertTrojan(config);
        } else if (config.startsWith('hysteria2://') || config.startsWith('hy2://')) {
          converted = convertHysteria2(config);
        } else if (config.startsWith('ss://')) {
          converted = convertShadowsocks(config);
        } else if (config.startsWith('wg://')) {
          converted = convertWireguard(config);
        } else {
          continue;
        }
        if (converted) {
          outbounds.push(converted);
          validTags.push(converted.tag);
        }
      }
      if (outbounds.length === 0) throw new Error('No valid configurations found');
      const singboxConfig = createSingboxConfig(outbounds, validTags);
      const jsonString = JSON.stringify(singboxConfig, null, 2);
      editor.setValue(jsonString);
      editor.clearSelection();
      errorDiv.textContent = '';
      stopLoading();
    } catch (error) {
      errorDiv.textContent = error.message;
      editor.setValue('');
      stopLoading();
    }
  }, 2000);
}
function createSingboxConfig(outbounds, validTags) {
  return {
    dns: {
      final: "local-dns",
      rules: [
        { clash_mode: "Global", server: "proxy-dns", source_ip_cidr: ["172.19.0.0/30"] },
        { server: "proxy-dns", source_ip_cidr: ["172.19.0.0/30"] },
        { clash_mode: "Direct", server: "direct-dns" }
      ],
      servers: [
        { address: "tls://208.67.222.123", address_resolver: "local-dns", detour: "proxy", tag: "proxy-dns" },
        { address: "local", detour: "direct", tag: "local-dns" },
        { address: "rcode://success", tag: "block" },
        { address: "local", detour: "direct", tag: "direct-dns" }
      ],
      strategy: "prefer_ipv4",
      cache: true
    },
    inbounds: [
      {
        address: ["172.19.0.1/30", "fdfe:dcba:9876::1/126"],
        auto_route: true,
        endpoint_independent_nat: false,
        mtu: 9000,
        fragment: { enabled: true, size: 1400 },
        platform: {
          http_proxy: { enabled: true, server: "127.0.0.1", server_port: 2080 }
        },
        sniff: true,
        stack: "system",
        strict_route: false,
        type: "tun"
      },
      {
        listen: "127.0.0.1",
        listen_port: 2080,
        sniff: true,
        type: "mixed",
        users: []
      }
    ],
    outbounds: [
      { tag: "proxy", type: "selector", outbounds: ["auto"].concat(validTags).concat(["direct"]) },
      { tag: "auto", type: "urltest", outbounds: validTags, url: "http://www.gstatic.com/generate_204", interval: "10m", tolerance: 50 },
      { tag: "direct", type: "direct" },
      ...outbounds
    ],
    route: {
      auto_detect_interface: true,
      final: "proxy",
      rules: [
        { clash_mode: "Direct", outbound: "direct" },
        { clash_mode: "Global", outbound: "proxy" },
        { protocol: "dns", action: "hijack-dns" }
      ]
    },
    wireguard: {
      enabled: true,
      peers: []
    }
  };
}