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

function decodeNestedBase64(str) {
    let result = str;
    while (isBase64(result)) {
        try {
            result = atob(result);
        } catch (e) {
            break;
        }
    }
    return result;
}

function parseSsConfig(config) {
    try {
        const base64Part = config.replace('ss://', '').split('#')[0];
        const decoded = atob(base64Part);
        const [methodPassword, hostPort] = decoded.split('@');
        const [method, password] = methodPassword.split(':');
        const [host, port] = hostPort.split(':');
        return {
            type: 'shadowsocks',
            tag: `ss-${host}-${port}`,
            server: host,
            server_port: parseInt(port),
            method: method,
            password: password
        };
    } catch (e) {
        return null;
    }
}

function parseVmessConfig(config) {
    try {
        const base64Part = config.replace('vmess://', '');
        const decoded = decodeNestedBase64(base64Part);
        const jsonConfig = JSON.parse(decoded);
        return {
            type: 'vmess',
            tag: `vmess-${jsonConfig.add}-${jsonConfig.port}`,
            server: jsonConfig.add,
            server_port: parseInt(jsonConfig.port),
            uuid: jsonConfig.id,
            security: jsonConfig.scy || 'auto',
            network: jsonConfig.net || 'tcp'
        };
    } catch (e) {
        return null;
    }
}

function parseVlessConfig(config) {
    try {
        const base64Part = config.replace('vless://', '').split('#')[0];
        const [userHost] = atob(base64Part).split('@');
        const [uuid, hostPort] = userHost.split('@');
        const [host, port] = hostPort.split(':');
        return {
            type: 'vless',
            tag: `vless-${host}-${port}`,
            server: host,
            server_port: parseInt(port),
            uuid: uuid,
            security: 'none'
        };
    } catch (e) {
        return null;
    }
}

function parseTrojanConfig(config) {
    try {
        const base64Part = config.replace('trojan://', '').split('#')[0];
        const [passwordHost] = atob(base64Part).split('@');
        const [password, hostPort] = passwordHost.split('@');
        const [host, port] = hostPort.split(':');
        return {
            type: 'trojan',
            tag: `trojan-${host}-${port}`,
            server: host,
            server_port: parseInt(port),
            password: password
        };
    } catch (e) {
        return null;
    }
}

function parseHysteria2Config(config) {
    try {
        const base64Part = config.replace('hysteria2://', '').split('#')[0];
        const decoded = atob(base64Part);
        const [passwordHost] = decoded.split('@');
        const [password, hostPort] = passwordHost.split('@');
        const [host, port] = hostPort.split(':');
        return {
            type: 'hysteria2',
            tag: `hysteria2-${host}-${port}`,
            server: host,
            server_port: parseInt(port),
            password: password
        };
    } catch (e) {
        return null;
    }
}

async function extractStandardConfigs(input) {
    const configs = [];
    const lines = input.split('\n').map(line => line.trim()).filter(line => line);

    for (const line of lines) {
        if (isLink(line)) {
            const content = await fetchContent(line);
            if (content) {
                const subConfigs = extractConfigsFromText(content);
                configs.push(...subConfigs);
            }
        } else if (isBase64(line)) {
            try {
                const decoded = decodeNestedBase64(line);
                const subConfigs = extractConfigsFromText(decoded);
                configs.push(...subConfigs);
                const nestedLines = decoded.split('\n').map(line => line.trim()).filter(line => line);
                for (const nestedLine of nestedLines) {
                    if (isBase64(nestedLine)) {
                        try {
                            const nestedDecoded = decodeNestedBase64(nestedLine);
                            const nestedConfigs = extractConfigsFromText(nestedDecoded);
                            configs.push(...nestedConfigs);
                        } catch (e) {
                            console.error('Failed to decode nested Base64:', e);
                        }
                    }
                }
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
                if (config.startsWith('vmess://')) {
                    converted = parseVmessConfig(config);
                } else if (config.startsWith('vless://')) {
                    converted = parseVlessConfig(config);
                } else if (config.startsWith('trojan://')) {
                    converted = parseTrojanConfig(config);
                } else if (config.startsWith('hysteria2://') || config.startsWith('hy2://')) {
                    converted = parseHysteria2Config(config);
                } else if (config.startsWith('ss://')) {
                    converted = parseSsConfig(config);
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