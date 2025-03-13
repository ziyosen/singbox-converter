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
    const response = await fetch(link);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    let text = await response.text();
    text = text.trim();
    if (isBase64(text)) text = atob(text);
    return text;
}

function extractConfigsFromText(text) {
    const configs = [];
    const protocolPatterns = SUPPORTED_PROTOCOLS.map(protocol => ({
        protocol,
        regex: new RegExp(`(${protocol}[^\\s]+)`, 'g')
    }));
    for (const { regex } of protocolPatterns) {
        const matches = text.match(regex);
        if (matches) configs.push(...matches);
    }
    return configs;
}

async function extractStandardConfigs(input) {
    const configs = [];
    const lines = input.split('\n').map(line => line.trim()).filter(line => line);
    for (const line of lines) {
        if (isLink(line)) {
            const content = await fetchContent(line);
            if (content) configs.push(...extractConfigsFromText(content));
        } else if (isBase64(line)) {
            const decoded = atob(line);
            configs.push(...extractConfigsFromText(decoded));
        } else {
            configs.push(...extractConfigsFromText(line));
        }
    }
    const allText = input.replace(/\n/g, ' ');
    configs.push(...extractConfigsFromText(allText));
    return [...new Set(configs)];
}

function decodeConfigPart(encodedPart) {
    return isBase64(encodedPart) ? atob(encodedPart) : encodedPart;
}

function convertShadowsocks(config) {
    const encodedPart = config.split('ss://')[1].split('#')[0];
    const decoded = decodeConfigPart(encodedPart);
    const [methodAndPassword, serverAndPort] = decoded.split('@');
    const [method, password] = methodAndPassword.split(':');
    const [server, port] = serverAndPort.split(':');
    return {
        type: 'shadowsocks',
        tag: `ss-${server}-${port}`,
        server,
        server_port: parseInt(port, 10),
        method,
        password
    };
}

function convertVmess(config) {
    const encodedPart = config.split('vmess://')[1];
    const decoded = decodeConfigPart(encodedPart);
    const json = JSON.parse(decoded);
    return {
        type: 'vmess',
        tag: `vmess-${json.add}-${json.port}`,
        server: json.add,
        server_port: parseInt(json.port, 10),
        uuid: json.id,
        security: json.scy || 'auto',
        alter_id: parseInt(json.aid || 0, 10)
    };
}

function convertVless(config) {
    const encodedPart = config.split('vless://')[1].split('#')[0];
    const decoded = decodeConfigPart(encodedPart);
    const [uuid, rest] = decoded.split('@');
    const [serverAndPort, query] = rest.split('?');
    const [server, port] = serverAndPort.split(':');
    const params = new URLSearchParams(query);
    return {
        type: 'vless',
        tag: `vless-${server}-${port}`,
        server,
        server_port: parseInt(port, 10),
        uuid,
        flow: params.get('flow') || '',
        packet_encoding: 'xudp'
    };
}

function convertTrojan(config) {
    const encodedPart = config.split('trojan://')[1].split('#')[0];
    const decoded = decodeConfigPart(encodedPart);
    const [password, rest] = decoded.split('@');
    const [serverAndPort, query] = rest.split('?');
    const [server, port] = serverAndPort.split(':');
    return {
        type: 'trojan',
        tag: `trojan-${server}-${port}`,
        server,
        server_port: parseInt(port, 10),
        password
    };
}

function convertHysteria2(config) {
    const encodedPart = config.split(/hysteria2:\/\/|hy2:\/\//)[1].split('#')[0];
    const decoded = decodeConfigPart(encodedPart);
    const [password, rest] = decoded.split('@');
    const [serverAndPort, query] = rest.split('?');
    const [server, port] = serverAndPort.split(':');
    return {
        type: 'hysteria2',
        tag: `hy2-${server}-${port}`,
        server,
        server_port: parseInt(port, 10),
        password
    };
}

async function convertConfig() {
    const input = document.getElementById('input').value.trim();
    const errorDiv = document.getElementById('error');
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
                if (config.startsWith('vmess://')) converted = convertVmess(config);
                else if (config.startsWith('vless://')) converted = convertVless(config);
                else if (config.startsWith('trojan://')) converted = convertTrojan(config);
                else if (config.startsWith('hysteria2://') || config.startsWith('hy2://')) converted = convertHysteria2(config);
                else if (config.startsWith('ss://')) converted = convertShadowsocks(config);
            } catch (e) {
                console.error(`Failed to convert config: ${config}`, e);
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
        document.getElementById('downloadButton').disabled = false;
    } catch (error) {
        errorDiv.textContent = error.message;
        editor.setValue('');
        document.getElementById('downloadButton').disabled = true;
    } finally {
        stopLoading();
    }
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
            strategy: "prefer_ipv4"
        },
        inbounds: [
            {
                address: ["172.19.0.1/30", "fdfe:dcba:9876::1/126"],
                auto_route: true,
                endpoint_independent_nat: false,
                mtu: 9000,
                platform: { http_proxy: { enabled: true, server: "127.0.0.1", server_port: 2080 } },
                sniff: true,
                stack: "system",
                strict_route: false,
                type: "tun"
            },
            { listen: "127.0.0.1", listen_port: 2080, sniff: true, type: "mixed", users: [] }
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
        }
    };
}