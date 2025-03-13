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

function decodeBase64IfNeeded(str) {
    if (isBase64(str)) {
        try {
            return atob(str);
        } catch (e) {
            console.error(`Failed to decode Base64: ${str}`, e);
        }
    }
    return str;
}

function processConfig(config) {
    for (const protocol of SUPPORTED_PROTOCOLS) {
        if (config.startsWith(protocol)) {
            const content = config.slice(protocol.length);
            const decodedContent = decodeBase64IfNeeded(content.split('#')[0]);
            return `${protocol}${decodedContent}${content.includes('#') ? '#' + content.split('#')[1] : ''}`;
        }
    }
    return config;
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
            matches.forEach(match => {
                const processedMatch = processConfig(match);
                if (SUPPORTED_PROTOCOLS.some(protocol => processedMatch.startsWith(protocol))) {
                    configs.push(processedMatch);
                } else if (isBase64(processedMatch)) {
                    const nestedConfigs = extractConfigsFromText(decodeBase64IfNeeded(processedMatch));
                    configs.push(...nestedConfigs);
                }
            });
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
                const subConfigs = extractConfigsFromText(content);
                configs.push(...subConfigs);
            }
        } else if (isBase64(line)) {
            try {
                const decoded = atob(line);
                const subConfigs = extractConfigsFromText(decoded);
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