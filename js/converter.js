const SUPPORTED_PROTOCOLS = ['vmess://', 'vless://', 'trojan://', 'hysteria2://', 'hy2://', 'ss://'];
function isLink(str) {
    return str.startsWith('http://') || str.startsWith('https://') || str.startsWith('ssconf://');
}
function isBase64(str) {
    if (!str || str.length % 4 !== 0) return false;
    const base64Regex = /^[A-Za-z0-9+/=]+$/;
    return base64Regex.test(str);
}
async function fetchContent(link) {
    if (link.startsWith('ssconf://')) {
        link = link.replace('ssconf://', 'https://');
    }
    try {
        const response = await fetch(link);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        let text = await response.text();
        text = text.trim();
        if (isBase64(text)) {
            try {
                text = atob(text);
            } catch (e) {
                console.error(`Failed to decode Base64 from ${link}:`, e);
            }
        }
        return text;
    } catch (error) {
        console.error(`Failed to fetch ${link}:`, error);
        return null;
    }
}
function extractConfigsFromText(text) {
    const configs = [];
    const protocolPatterns = SUPPORTED_PROTOCOLS.map(protocol => ({
        protocol,
        regex: new RegExp(`(${protocol}[^\\s]+)`, 'g')
    }));
    for (const { regex } of protocolPatterns) {
        const matches = text.match(regex);
        if (matches) {
            configs.push(...matches);
        }
    }
    return configs;
}
async function extractStandardConfigs(input) {
    const configs = [];
    const lines = input.split('\n').map(line => line.trim()).filter(line => line);
    for (const line of lines) {
        if (isLink(line)) {
            const content = await fetchContent(line);
            if (content) {
                const subConfigs = await processContent(content);
                configs.push(...subConfigs);
            }
        } else if (isBase64(line)) {
            try {
                const decoded = atob(line);
                const subConfigs = await processContent(decoded);
                configs.push(...subConfigs);
            } catch (e) {
                console.error('Failed to decode Base64:', e);
            }
        } else {
            const subConfigs = extractConfigsFromText(line);
            configs.push(...subConfigs);
        }
    }
    const allText = input.replace(/\n/g, ' ');
    const subConfigsFromText = extractConfigsFromText(allText);
    configs.push(...subConfigsFromText);
    return [...new Set(configs)];
}
async function processContent(content) {
    const configs = [];
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    for (const line of lines) {
        if (isBase64(line)) {
            try {
                const decoded = atob(line);
                const subConfigs = extractConfigsFromText(decoded);
                configs.push(...subConfigs);
            } catch (e) {
                console.error('Failed to decode nested Base64:', e);
            }
        } else {
            const subConfigs = extractConfigsFromText(line);
            configs.push(...subConfigs);
        }
    }
    return configs;
}
async function convertConfig() {
    const input = document.getElementById('input').value.trim();
    const errorDiv = document.getElementById('error');
    const enableAdBlockAndIran = document.getElementById('enableAdBlockAndIran').checked;
    if (!input) {
        errorDiv.textContent = 'Please enter proxy configurations';
        return;
    }
    startLoading();
    try {
        const configs = await extractStandardConfigs(input);
        const outbounds = [];
        const validTags = [];
        for (const config of configs) {
            let converted;
            try {
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
                }
            } catch (e) {
                console.error(`Failed to convert config: ${config}`, e);
                continue;
            }
            if (converted) {
                outbounds.push(converted);
                validTags.push(converted.tag);
            }
        }
        if (outbounds.length === 0) {
            throw new Error('No valid configurations found');
        }
        const singboxConfig = enableAdBlockAndIran ? createEnhancedSingboxConfig(outbounds, validTags) : createSingboxConfig(outbounds, validTags);
        const jsonString = JSON.stringify(singboxConfig, null, 2);
        editor.setValue(jsonString);
        editor.clearSelection();
        errorDiv.textContent = '';
        document.getElementById('downloadButton').disabled = false;
    } catch (error) {
        errorDiv.textContent = error.message;
        editor.setValue('');
        document.getElementById('downloadButton').disabled = true;
    } finally {
        stopLoading();
    }
}
function reverseConvertConfig() {
    const input = document.getElementById('input').value.trim();
    const errorDiv = document.getElementById('error');
    if (!input) {
        errorDiv.textContent = 'Please enter Sing-box JSON configuration';
        return;
    }
    let config;
    try {
        config = JSON.parse(input);
    } catch (e) {
        errorDiv.textContent = 'Invalid JSON input';
        return;
    }
    if (!config.outbounds || !Array.isArray(config.outbounds)) {
        errorDiv.textContent = 'Invalid Sing-box configuration';
        return;
    }
    const plainConfigs = [];
    for (const outbound of config.outbounds) {
        if (!outbound.type || ["selector", "urltest", "direct"].includes(outbound.type) || ["proxy","auto","direct"].includes(outbound.tag)) continue;
        if (outbound.type === "vmess") {
            const plain = reverseConvertVmess(outbound);
            if (plain) plainConfigs.push(plain);
        } else if (outbound.type === "vless") {
            const plain = reverseConvertVless(outbound);
            if (plain) plainConfigs.push(plain);
        } else if (outbound.type === "trojan") {
            const plain = reverseConvertTrojan(outbound);
            if (plain) plainConfigs.push(plain);
        } else if (outbound.type === "hysteria2") {
            const plain = reverseConvertHysteria2(outbound);
            if (plain) plainConfigs.push(plain);
        } else if (outbound.type === "shadowsocks") {
            const plain = reverseConvertShadowsocks(outbound);
            if (plain) plainConfigs.push(plain);
        }
    }
    if (plainConfigs.length === 0) {
        errorDiv.textContent = 'No convertible outbound configurations found';
        editor.setValue('');
        return;
    }
    editor.setValue(plainConfigs.join('\n'));
    editor.clearSelection();
    errorDiv.textContent = '';
}
function reverseConvertVmess(outbound) {
    const data = {};
    data.add = outbound.server;
    data.port = outbound.server_port.toString();
    data.id = outbound.uuid;
    data.aid = outbound.alter_id ? outbound.alter_id.toString() : "0";
    data.scy = outbound.security || "auto";
    data.tls = (outbound.tls && outbound.tls.enabled) ? "tls" : "";
    if (outbound.transport && outbound.transport.type && outbound.transport.type !== "tcp") {
        data.net = outbound.transport.type;
        if (outbound.transport.path) data.path = outbound.transport.path;
        if (outbound.transport.headers && outbound.transport.headers.Host) data.host = outbound.transport.headers.Host;
    } else {
        data.net = "tcp";
    }
    return "vmess://" + btoa(JSON.stringify(data));
}
function reverseConvertVless(outbound) {
    let url = "vless://" + outbound.uuid + "@" + outbound.server + ":" + outbound.server_port;
    const params = new URLSearchParams();
    if (outbound.tls && outbound.tls.enabled) {
        params.append("sni", outbound.tls.server_name || outbound.server);
    }
    if (outbound.flow) {
        params.append("flow", outbound.flow);
    }
    if (outbound.transport && outbound.transport.type === "ws") {
        params.append("type", "ws");
        if (outbound.transport.path) params.append("path", outbound.transport.path);
        if (outbound.transport.headers && outbound.transport.headers.Host) params.append("host", outbound.transport.headers.Host);
    }
    const query = params.toString();
    if (query) url += "?" + query;
    return url;
}
function reverseConvertTrojan(outbound) {
    let url = "trojan://" + outbound.password + "@" + outbound.server + ":" + outbound.server_port;
    const params = new URLSearchParams();
    if (outbound.tls && outbound.tls.enabled) {
        params.append("sni", outbound.tls.server_name || outbound.server);
        if (outbound.tls.alpn && Array.isArray(outbound.tls.alpn) && outbound.tls.alpn.length > 0) {
            params.append("alpn", outbound.tls.alpn.join(","));
        }
    }
    if (outbound.transport && outbound.transport.type && outbound.transport.type !== "tcp") {
        params.append("type", outbound.transport.type);
        if (outbound.transport.path) params.append("path", outbound.transport.path);
    }
    const query = params.toString();
    if (query) url += "?" + query;
    return url;
}
function reverseConvertHysteria2(outbound) {
    let url = "hysteria2://" + outbound.password + "@" + outbound.server + ":" + outbound.server_port;
    const params = new URLSearchParams();
    if (outbound.tls && outbound.tls.enabled) {
        params.append("sni", outbound.tls.server_name || outbound.server);
    }
    const query = params.toString();
    if (query) url += "?" + query;
    return url;
}
function reverseConvertShadowsocks(outbound) {
    const userInfo = btoa(outbound.method + ":" + outbound.password);
    return "ss://" + userInfo + "@" + outbound.server + ":" + outbound.server_port;
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
                {
                    address: "tls://208.67.222.123",
                    address_resolver: "local-dns",
                    detour: "proxy",
                    tag: "proxy-dns"
                },
                {
                    address: "local",
                    detour: "direct",
                    tag: "local-dns"
                },
                {
                    address: "rcode://success",
                    tag: "block"
                },
                {
                    address: "local",
                    detour: "direct",
                    tag: "direct-dns"
                }
            ],
            strategy: "prefer_ipv4"
        },
        inbounds: [
            {
                address: ["172.19.0.1/30", "fdfe:dcba:9876::1/126"],
                auto_route: true,
                endpoint_independent_nat: false,
                mtu: 9000,
                platform: {
                    http_proxy: {
                        enabled: true,
                        server: "127.0.0.1",
                        server_port: 2080
                    }
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
            {
                tag: "proxy",
                type: "selector",
                outbounds: ["auto"].concat(validTags).concat(["direct"])
            },
            {
                tag: "auto",
                type: "urltest",
                outbounds: validTags,
                url: "http://www.gstatic.com/generate_204",
                interval: "10m",
                tolerance: 50
            },
            {
                tag: "direct",
                type: "direct"
            },
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
        }
    };
}
function createEnhancedSingboxConfig(outbounds, validTags) {
    return {
        dns: {
            final: "local-dns",
            rules: [
                { clash_mode: "Global", server: "proxy-dns", source_ip_cidr: ["172.19.0.0/30"] },
                { server: "proxy-dns", source_ip_cidr: ["172.19.0.0/30"] },
                { clash_mode: "Direct", server: "direct-dns" },
                {
                    rule_set: ["geosite-ir"],
                    server: "direct-dns"
                },
                {
                    rule_set: ["geosite-category-ads-all", "geosite-malware", "geosite-phishing", "geosite-cryptominers"],
                    server: "block"
                }
            ],
            servers: [
                {
                    address: "tls://208.67.222.123",
                    address_resolver: "local-dns",
                    detour: "proxy",
                    tag: "proxy-dns"
                },
                {
                    address: "local",
                    detour: "direct",
                    tag: "local-dns"
                },
                {
                    address: "rcode://success",
                    tag: "block"
                },
                {
                    address: "local",
                    detour: "direct",
                    tag: "direct-dns"
                }
            ],
            strategy: "prefer_ipv4"
        },
        inbounds: [
            {
                address: ["172.19.0.1/30", "fdfe:dcba:9876::1/126"],
                auto_route: true,
                endpoint_independent_nat: false,
                mtu: 9000,
                platform: {
                    http_proxy: {
                        enabled: true,
                        server: "127.0.0.1",
                        server_port: 2080
                    }
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
            {
                tag: "proxy",
                type: "selector",
                outbounds: ["auto"].concat(validTags).concat(["direct"])
            },
            {
                tag: "auto",
                type: "urltest",
                outbounds: validTags,
                url: "http://www.gstatic.com/generate_204",
                interval: "10m",
                tolerance: 50
            },
            {
                tag: "direct",
                type: "direct"
            },
            ...outbounds
        ],
        route: {
            auto_detect_interface: true,
            final: "proxy",
            rules: [
                { clash_mode: "Direct", outbound: "direct" },
                { clash_mode: "Global", outbound: "proxy" },
                { protocol: "dns", action: "hijack-dns" },
                {
                    domain_suffix: [".ir"],
                    outbound: "direct"
                },
                {
                    rule_set: ["geoip-ir", "geosite-ir"],
                    outbound: "direct"
                },
                {
                    rule_set: ["geosite-category-ads-all", "geosite-malware", "geosite-phishing", "geosite-cryptominers", "geoip-malware", "geoip-phishing"],
                    outbound: "block"
                }
            ],
            rule_set: [
                {
                    tag: "geosite-ir",
                    type: "remote",
                    format: "binary",
                    url: "https://raw.githubusercontent.com/Chocolate4U/Iran-sing-box-rules/rule-set/geosite-ir.srs",
                    download_detour: "direct",
                    update_interval: "1d"
                },
                {
                    tag: "geosite-category-ads-all",
                    type: "remote",
                    format: "binary",
                    url: "https://raw.githubusercontent.com/Chocolate4U/Iran-sing-box-rules/rule-set/geosite-category-ads-all.srs",
                    download_detour: "direct",
                    update_interval: "1d"
                },
                {
                    tag: "geosite-malware",
                    type: "remote",
                    format: "binary",
                    url: "https://raw.githubusercontent.com/Chocolate4U/Iran-sing-box-rules/rule-set/geosite-malware.srs",
                    download_detour: "direct",
                    update_interval: "1d"
                },
                {
                    tag: "geosite-phishing",
                    type: "remote",
                    format: "binary",
                    url: "https://raw.githubusercontent.com/Chocolate4U/Iran-sing-box-rules/rule-set/geosite-phishing.srs",
                    download_detour: "direct",
                    update_interval: "1d"
                },
                {
                    tag: "geosite-cryptominers",
                    type: "remote",
                    format: "binary",
                    url: "https://raw.githubusercontent.com/Chocolate4U/Iran-sing-box-rules/rule-set/geosite-cryptominers.srs",
                    download_detour: "direct",
                    update_interval: "1d"
                },
                {
                    tag: "geoip-ir",
                    type: "remote",
                    format: "binary",
                    url: "https://raw.githubusercontent.com/Chocolate4U/Iran-sing-box-rules/rule-set/geoip-ir.srs",
                    download_detour: "direct",
                    update_interval: "1d"
                },
                {
                    tag: "geoip-malware",
                    type: "remote",
                    format: "binary",
                    url: "https://raw.githubusercontent.com/Chocolate4U/Iran-sing-box-rules/rule-set/geoip-malware.srs",
                    download_detour: "direct",
                    update_interval: "1d"
                },
                {
                    tag: "geoip-phishing",
                    type: "remote",
                    format: "binary",
                    url: "https://raw.githubusercontent.com/Chocolate4U/Iran-sing-box-rules/rule-set/geoip-phishing.srs",
                    download_detour: "direct",
                    update_interval: "1d"
                }
            ]
        }
    };
}
function convertVmess(input) {
    try {
        const data = JSON.parse(atob(input.replace('vmess://', '')));
        if (!data.add || !data.port || !data.id) return null;
        const transport = {};
        if (data.net === 'ws' || data.net === 'h2') {
            if (data.path) transport.path = data.path;
            if (data.host) transport.headers = { Host: data.host };
            transport.type = data.net;
        }
        return {
            type: "vmess",
            tag: `vmess-${generateUUID().slice(0, 8)}`,
            server: data.add,
            server_port: parseInt(data.port),
            uuid: data.id,
            security: data.scy || "auto",
            alter_id: parseInt(data.aid || 0),
            transport: transport,
            tls: {
                enabled: data.tls === 'tls',
                insecure: true,
                server_name: data.sni || data.add
            }
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
        const transport = {};
        if (params.get('type') === 'ws') {
            if (params.get('path')) transport.path = params.get('path');
            if (params.get('host')) transport.headers = { Host: params.get('host') };
            transport.type = 'ws';
        }
        return {
            type: "vless",
            tag: `vless-${generateUUID().slice(0, 8)}`,
            server: address,
            server_port: parseInt(port),
            uuid: url.username,
            flow: params.get('flow') || '',
            transport: transport,
            tls: {
                enabled: true,
                server_name: params.get('sni') || address,
                insecure: true
            }
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
        const transport = {};
        const type = params.get('type');
        if (type && type !== 'tcp' && params.get('path')) {
            transport.path = params.get('path');
            transport.type = type;
        }
        return {
            type: "trojan",
            tag: `trojan-${generateUUID().slice(0, 8)}`,
            server: url.hostname,
            server_port: parseInt(url.port || 443),
            password: url.username,
            transport: transport,
            tls: {
                enabled: true,
                server_name: params.get('sni') || url.hostname,
                insecure: true,
                alpn: (params.get('alpn') || '').split(',').filter(Boolean)
            }
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
            tag: `hysteria2-${generateUUID().slice(0, 8)}`,
            server: url.hostname,
            server_port: parseInt(url.port),
            password: url.username || params.get('password') || '',
            tls: {
                enabled: true,
                server_name: params.get('sni') || url.hostname,
                insecure: true
            }
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
        const [method, password] = atob(methodAndPass).split(':');
        const [server, port] = serverAndPort.split(':');
        if (!server || !port) return null;
        return {
            type: "shadowsocks",
            tag: `ss-${generateUUID().slice(0, 8)}`,
            server: server,
            server_port: parseInt(port),
            method: method,
            password: password
        };
    } catch (error) {
        throw new Error('Invalid Shadowsocks configuration');
    }
}
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}