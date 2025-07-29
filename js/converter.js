const SUPPORTED_PROTOCOLS = ['vmess://', 'vless://', 'trojan://', 'hysteria2://', 'hy2://', 'ss://'];
const CORS_PROXIES = [
    'https://api.allorigins.win/get?url=',
    'https://corsproxy.io/?',
    'https://cors-anywhere.herokuapp.com/',
    'https://api.codetabs.com/v1/proxy?quest=',
    'https://cors-proxy.htmldriven.com/?url=',
    'https://thingproxy.freeboard.io/fetch/'
];

function isLink(str) {
    return str.startsWith('http://') || str.startsWith('https://') || str.startsWith('ssconf://');
}

function isGoogleDriveLink(url) {
    return url.includes('drive.google.com');
}

function extractGoogleDriveId(url) {
    if (url.includes('id=')) {
        const idMatch = url.match(/id=([^&]+)/);
        if (idMatch && idMatch[1]) {
            return idMatch[1];
        }
    }
    
    if (url.includes('/d/')) {
        const idMatch = url.match(/\/d\/([^/]+)/);
        if (idMatch && idMatch[1]) {
            return idMatch[1];
        }
    }
    
    return null;
}

function isBase64(str) {
    if (!str || str.length % 4 !== 0) return false;
    const base64Regex = /^[A-Za-z0-9+/=]+$/;
    return base64Regex.test(str);
}

function isDataUriBase64(str) {
    return str.startsWith('data:') && str.includes('base64,');
}

function extractBase64FromDataUri(str) {
    const base64Part = str.split('base64,')[1];
    if (base64Part) {
        return base64Part;
    }
    return str;
}

async function fetchContent(link) {
    if (link.startsWith('ssconf://')) {
        link = link.replace('ssconf://', 'https://');
    }
    
    if (isGoogleDriveLink(link)) {
        const driveId = extractGoogleDriveId(link);
        if (driveId) {
            const directDownloadUrl = `https://drive.google.com/uc?export=download&id=${driveId}`;
            try {
                return await fetchWithFallbacks(directDownloadUrl);
            } catch (error) {
                console.error(`Failed to fetch Google Drive content:`, error);
                return null;
            }
        }
    }
    
    return await fetchWithFallbacks(link);
}

async function fetchWithFallbacks(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        let text = await response.text();
        text = text.trim();
        
        if (isDataUriBase64(text)) {
            const base64Content = extractBase64FromDataUri(text);
            try {
                return atob(base64Content);
            } catch (e) {
                console.error(`Failed to decode Base64 from data URI:`, e);
            }
        }
        
        if (isBase64(text)) {
            try {
                return atob(text);
            } catch (e) {
                console.error(`Failed to decode Base64:`, e);
            }
        }
        
        return text;
    } catch (error) {
        console.error(`Failed to fetch ${url} directly:`, error);
        
        for (const proxyUrl of CORS_PROXIES) {
            try {
                let fullProxyUrl;
                
                if (proxyUrl === CORS_PROXIES[0]) {
                    fullProxyUrl = `${proxyUrl}${encodeURIComponent(url)}`;
                    const response = await fetch(fullProxyUrl);
                    if (!response.ok) {
                        throw new Error(`HTTP error with ${proxyUrl}! status: ${response.status}`);
                    }
                    const data = await response.json();
                    let text = data.contents.trim();
                    
                    if (isDataUriBase64(text)) {
                        const base64Content = extractBase64FromDataUri(text);
                        try {
                            return atob(base64Content);
                        } catch (e) {
                            console.error(`Failed to decode Base64 from data URI via ${proxyUrl}:`, e);
                        }
                    }
                    
                    if (isBase64(text)) {
                        try {
                            return atob(text);
                        } catch (e) {
                            console.error(`Failed to decode Base64 from ${url} via ${proxyUrl}:`, e);
                        }
                    }
                    
                    return text;
                } else {
                    fullProxyUrl = `${proxyUrl}${encodeURIComponent(url)}`;
                    const response = await fetch(fullProxyUrl);
                    if (!response.ok) {
                        throw new Error(`HTTP error with ${proxyUrl}! status: ${response.status}`);
                    }
                    let text = await response.text();
                    text = text.trim();
                    
                    if (isDataUriBase64(text)) {
                        const base64Content = extractBase64FromDataUri(text);
                        try {
                            return atob(base64Content);
                        } catch (e) {
                            console.error(`Failed to decode Base64 from data URI via ${proxyUrl}:`, e);
                        }
                    }
                    
                    if (isBase64(text)) {
                        try {
                            return atob(text);
                        } catch (e) {
                            console.error(`Failed to decode Base64 from ${url} via ${proxyUrl}:`, e);
                        }
                    }
                    
                    return text;
                }
            } catch (proxyError) {
                console.error(`Failed to fetch ${url} via ${proxyUrl}:`, proxyError);
                continue;
            }
        }
        
        if (isGoogleDriveLink(url)) {
            const driveId = extractGoogleDriveId(url);
            if (driveId) {
                try {
                    const alternateUrl = `https://www.googleapis.com/drive/v3/files/${driveId}?alt=media`;
                    const response = await fetch(alternateUrl);
                    if (response.ok) {
                        let text = await response.text();
                        text = text.trim();
                        
                        if (isBase64(text)) {
                            try {
                                return atob(text);
                            } catch (e) {
                                console.error(`Failed to decode Base64 from alternate Google Drive API:`, e);
                            }
                        }
                        
                        return text;
                    }
                } catch (driveApiError) {
                    console.error(`Failed to fetch from Google Drive API:`, driveApiError);
                }
            }
        }
        
        console.error(`All fetch attempts failed for ${url}`);
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
        } else if (isDataUriBase64(line)) {
            try {
                const base64Part = extractBase64FromDataUri(line);
                const decoded = atob(base64Part);
                const subConfigs = await processContent(decoded);
                configs.push(...subConfigs);
            } catch (e) {
                console.error('Failed to decode Base64 from data URI:', e);
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
    
    if (isDataUriBase64(content)) {
        try {
            const base64Part = extractBase64FromDataUri(content);
            const decoded = atob(base64Part);
            return await processContent(decoded);
        } catch (e) {
            console.error('Failed to decode data URI:', e);
        }
    }
    
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
        } else if (isDataUriBase64(line)) {
            try {
                const base64Part = extractBase64FromDataUri(line);
                const decoded = atob(base64Part);
                const subConfigs = extractConfigsFromText(decoded);
                configs.push(...subConfigs);
            } catch (e) {
                console.error('Failed to decode nested data URI Base64:', e);
            }
        } else {
            const subConfigs = extractConfigsFromText(line);
            configs.push(...subConfigs);
        }
    }

    return configs;
}

function isSingboxJSON(text) {
    try {
        const json = JSON.parse(text);
        return json && typeof json === 'object' && json.outbounds && Array.isArray(json.outbounds);
    } catch (e) {
        return false;
    }
}

function convertFromJSON(jsonText) {
    const json = JSON.parse(jsonText);
    const outbounds = json.outbounds || [];
    const proxyConfigs = [];

    for (const outbound of outbounds) {
        if (outbound.type === 'vmess') {
            const vmessConfig = convertToVmess(outbound);
            if (vmessConfig) proxyConfigs.push(vmessConfig);
        } else if (outbound.type === 'vless') {
            const vlessConfig = convertToVless(outbound);
            if (vlessConfig) proxyConfigs.push(vlessConfig);
        } else if (outbound.type === 'trojan') {
            const trojanConfig = convertToTrojan(outbound);
            if (trojanConfig) proxyConfigs.push(trojanConfig);
        } else if (outbound.type === 'hysteria2') {
            const hysteria2Config = convertToHysteria2(outbound);
            if (hysteria2Config) proxyConfigs.push(hysteria2Config);
        } else if (outbound.type === 'shadowsocks') {
            const ssConfig = convertToShadowsocks(outbound);
            if (ssConfig) proxyConfigs.push(ssConfig);
        }
    }

    return proxyConfigs;
}

async function convertConfig() {
    window.vmessCount = 0;
    window.vlessCount = 0;
    window.trojanCount = 0;
    window.hysteria2Count = 0;
    window.ssCount = 0;

    let input = document.getElementById('input').value.trim();
    const errorDiv = document.getElementById('error');
    const enableAdBlockAndIran = document.getElementById('enableAdBlockAndIran').checked;
    const enableCustomTag = document.getElementById('enableCustomTag').checked;
    const customTagName = document.getElementById('customTagInput').value.trim();

    if (!input) {
        errorDiv.textContent = 'Please enter proxy configurations or Sing-box JSON';
        return;
    }

    startLoading();

    try {
        if (isLink(input)) {
            const content = await fetchContent(input);
            if (content && isSingboxJSON(content)) {
                input = content;
            } else if (content) {
                input = content;
            }
        } else if (isDataUriBase64(input)) {
            try {
                const base64Part = extractBase64FromDataUri(input);
                const decoded = atob(base64Part);
                if (isSingboxJSON(decoded)) {
                    input = decoded;
                } else {
                    input = decoded;
                }
            } catch (e) {
                console.error('Failed to decode data URI:', e);
            }
        }

        if (isSingboxJSON(input)) {
            const proxyConfigs = convertFromJSON(input);
            editor.setValue(proxyConfigs.join('\n'));
            editor.clearSelection();
            errorDiv.textContent = '';
            document.getElementById('downloadButton').disabled = false;
        } else {
            const configs = await extractStandardConfigs(input);
            const outbounds = [];
            const validTags = [];

            for (const config of configs) {
                let converted;
                try {
                    if (config.startsWith('vmess://')) {
                        converted = convertVmess(config, enableCustomTag, customTagName);
                    } else if (config.startsWith('vless://')) {
                        converted = convertVless(config, enableCustomTag, customTagName);
                    } else if (config.startsWith('trojan://')) {
                        converted = convertTrojan(config, enableCustomTag, customTagName);
                    } else if (config.startsWith('hysteria2://') || config.startsWith('hy2://')) {
                        converted = convertHysteria2(config, enableCustomTag, customTagName);
                    } else if (config.startsWith('ss://')) {
                        converted = convertShadowsocks(config, enableCustomTag, customTagName);
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
        }
    } catch (error) {
        errorDiv.textContent = error.message;
        editor.setValue('');
        document.getElementById('downloadButton').disabled = true;
    } finally {
        stopLoading();
    }
}

function createSingboxConfig(outbounds, validTags) {
    return{
    "log": {
        "disabled": true,
        "level": "debug",
        "output": "Nekobox.log",
        "timestamp": true
    },
    "dns": {
        "servers": [
            {
                "tag": "google-dns",
                "address": "tls://dns.google",
                "address_resolver": "dns-local",
                "address_strategy": "prefer_ipv4",
                "strategy": "ipv4_only",
                "detour": "🚀 Latency"
            },
            {
                "tag": "cloudflare-dns",
                "address": "https://cloudflare-dns.com/dns-query",
                "address_resolver": "dns-local",
                "address_strategy": "prefer_ipv4",
                "strategy": "ipv4_only",
                "detour": "🌐 Internet"
            },
            {
                "tag": "dns-local",
                "address": "local",
                "address_resolver": "local",
                "address_strategy": "prefer_ipv4",
                "strategy": "ipv4_only"
            },
            {
                "tag": "block-dns",
                "address": "rcode://success",
                "detour": "block"
            }
        ],
        "rules": [
            {
                "domain": [
                    "plus-store.naver.com",
                    "ava.game.naver.com",
                    "investor.fb.com",
                    "investors.spotify.com",
                    "nontontv.vidio.com",
                    "support.vidio.com",
                    "img.email2.vidio.com",
                    "quiz.int.vidio.com",
                    "quiz.vidio.com"
                ],
                "server": "dns-local"
            },
            {
                "network": "udp",
                "port": 443,
                "action": "reject",
                "method": "drop"
            },
            {
                "domain": [
                    
                ],
                "server": "google-dns",
                "action": "route"
            },
            {
                "outbound": "🚀 Latency",
                "server": "google-dns",
                "rewrite_ttl": 7200
            },
            {
                "outbound": "🌐 Internet",
                "server": "cloudflare-dns",
                "rewrite_ttl": 7200
            }
        ],
        "strategy": "ipv4_only",
        "independent_cache": true
    },
    "inbounds": [
        {
            "type": "tun",
            "tag": "tun-in",
            "interface_name": "tunelm0n",
            "mtu": 1590,
            "address": [
                "172.18.0.1/30",
                "fdfe:dcba:9876::1/126"
            ],
            "auto_route": true,
            "strict_route": true,
            "stack": "gvisor",
            "sniff": true,
            "endpoint_independent_nat": true
        },
        {
            "type": "mixed",
            "tag": "mixed-in",
            "listen": "0.0.0.0",
            "listen_port": 2080,
            "tcp_fast_open": true,
            "sniff": true,
            "sniff_override_destination": true
        },
        {
            "type": "socks",
            "tag": "socks-in",
            "listen": "0.0.0.0",
            "listen_port": 2082,
            "tcp_fast_open": true
        },
        {
            "type": "direct",
            "tag": "direct-in",
            "override_address": "112.215.203.246",
            "override_port": 53
        }
    ],
    "outbounds": [
        {
            "type": "selector",
            "tag": "🌐 Internet",
            "outbounds": [
                "🚀 Latency",
                "direct-out",
                
            ],
            "default": "🚀 Latency"
        },
        {
            "type": "urltest",
            "tag": "🚀 Latency",
            "outbounds": [

                
            ],
            "url": "https://connectivitycheck.gstatic.com/generate_204",
            "interval": "1m30s",
            "tolerance": 60,
            "idle_timeout": "5m0s"
        },
        {
            "type": "direct",
            "tag": "direct-out"
        },
        {
            "type": "block",
            "tag": "block"
        },
        
    ],
    "route": {
        "rules": [
            {
                "type": "logical",
                "mode": "or",
                "rules": [
                    {
                        "protocol": "dns"
                    },
                    {
                        "port": 53
                    }
                ],
                "action": "hijack-dns"
            }
        ],
        "final": "🌐 Internet",
        "auto_detect_interface": true
    },
    "experimental": {
        "clash_api": {
            "external_controller": "0.0.0.0:9090",
            "external_ui": "dist",
            "external_ui_download_url": "https://github.com/Zephyruso/zashboard/releases/latest/download/dist-cdn-fonts.zip",
            "external_ui_download_detour": "🌐 Internet",
            "default_mode": "rule",
            "access_control_allow_origin": "*"
        }
    }
}

function createEnhancedSingboxConfig(outbounds, validTags) {
    return{
    "log": {
        "disabled": true,
        "level": "debug",
        "output": "Nekobox.log",
        "timestamp": true
    },
    "dns": {
        "servers": [
            {
                "tag": "google-dns",
                "address": "tls://dns.google",
                "address_resolver": "dns-local",
                "address_strategy": "prefer_ipv4",
                "strategy": "ipv4_only",
                "detour": "🚀 Latency"
            },
            {
                "tag": "cloudflare-dns",
                "address": "https://cloudflare-dns.com/dns-query",
                "address_resolver": "dns-local",
                "address_strategy": "prefer_ipv4",
                "strategy": "ipv4_only",
                "detour": "🌐 Internet"
            },
            {
                "tag": "dns-local",
                "address": "local",
                "address_resolver": "local",
                "address_strategy": "prefer_ipv4",
                "strategy": "ipv4_only"
            },
            {
                "tag": "block-dns",
                "address": "rcode://success",
                "detour": "block"
            }
        ],
        "rules": [
            {
                "domain": [
                    "plus-store.naver.com",
                    "ava.game.naver.com",
                    "investor.fb.com",
                    "investors.spotify.com",
                    "nontontv.vidio.com",
                    "support.vidio.com",
                    "img.email2.vidio.com",
                    "quiz.int.vidio.com",
                    "quiz.vidio.com"
                ],
                "server": "dns-local"
            },
            {
                "network": "udp",
                "port": 443,
                "action": "reject",
                "method": "drop"
            },
            {
                "domain": [
               
                    
                    
                ],
                "server": "google-dns",
                "action": "route"
            },
            {
                "outbound": "🚀 Latency",
                "server": "google-dns",
                "rewrite_ttl": 7200
            },
            {
                "outbound": "🔞 Porn",
                "server": "block-dns"
            },
            {
                "outbound": "🎯 Ads",
                "server": "block-dns"
            },
            {
                "rule_set": [
                    "geosite-facebook1",
                    "geosite-facebook3",
                    "facebook-dev",
                    "facebook-ipcidr",
                    "geosite-instagram",
                    "geosite-discord",
                    "geosite-tiktok",
                    "AS32934",
                    "Google-AS15169",
                    "google-ipcidr",
                    "google-scholar",
                    "speedtest",
                    "messenger"
                ],
                "outbound": "🌐 Internet",
                "action": "route",
                "server": "dns-local",
                "rewrite_ttl": 7200
            },
            {
                "domain_suffix": [
                    "dailymotion.com",
                    "dm-event.net",
                    "dmcdn.net",
                    "maki.my.id",
                    "kuramanime.run",
                    "filemoon.sx",
                    "mega.co.nz",
                    "ghbrisk.com"
                ],
                "rule_set": [
                    "geosite-youtube",
                    "geosite-openai",
                    "geosite-google",
                    "geoip-id"
                ],
                "outbound": "🌐 Internet",
                "action": "route",
                "server": "google-dns",
                "rewrite_ttl": 7200
            }
        ],
        "strategy": "ipv4_only",
        "independent_cache": true
    },
    "inbounds": [
        {
            "type": "tun",
            "tag": "tun-in",
            "interface_name": "tunelm0n",
            "mtu": 1590,
            "address": [
                "172.18.0.1/30",
                "fdfe:dcba:9876::1/126"
            ],
            "auto_route": true,
            "strict_route": true,
            "stack": "gvisor",
            "sniff": true,
            "endpoint_independent_nat": true
        },
        {
            "type": "mixed",
            "tag": "mixed-in",
            "listen": "0.0.0.0",
            "listen_port": 2080,
            "tcp_fast_open": true,
            "sniff": true,
            "sniff_override_destination": true
        },
        {
            "type": "socks",
            "tag": "socks-in",
            "listen": "0.0.0.0",
            "listen_port": 2082,
            "tcp_fast_open": true
        },
        {
            "type": "direct",
            "tag": "direct-in",
            "override_address": "112.215.203.246",
            "override_port": 53
        }
    ],
    "outbounds": [
        {
            "type": "selector",
            "tag": "🌐 Internet",
            "outbounds": [
                "🚀 Latency",
                "direct-out"
            ],
            "default": "🚀 Latency"
        },
        {
            "type": "urltest",
            "tag": "🚀 Latency",
            "outbounds": [
                

            ],
            "url": "https://connectivitycheck.gstatic.com/generate_204",
            "interval": "1m30s",
            "tolerance": 60,
            "idle_timeout": "5m0s"
        },
        {
            "type": "selector",
            "tag": "🔞 Porn",
            "outbounds": [
                "block",
                "🌐 Internet"
            ]
        },
        {
            "type": "selector",
            "tag": "🎯 Ads",
            "outbounds": [
                "block",
                "🌐 Internet"
            ]
        },
        {
            "type": "selector",
            "tag": "📞 Rule-WA",
            "outbounds": [
                "direct-out",
                "🌐 Internet"
            ],
            "default": "🌐 Internet"
        },
        {
            "type": "direct",
            "tag": "direct-out"
        },
        {
            "type": "block",
            "tag": "block"
        },
        

    ],
    "route": {
        "rules": [
            {
                "type": "logical",
                "mode": "or",
                "rules": [
                    {
                        "protocol": "dns"
                    },
                    {
                        "port": 53
                    }
                ],
                "action": "hijack-dns"
            },
            {
                "rule_set": [
                    "pornholeindo",
                    "category-porn",
                    "nsfw-onlydomains",
                    "porn-ags"
                ],
                "domain_keyword": [
                    "avtube"
                ],
                "outbound": "🔞 Porn"
            },
            {
                "rule_set": [
                    "geosite-rule-ads",
                    "Ads-Adaway",
                    "Ads-Abpindo",
                    "GoodbyeAds-YouTube-AdBlock-Filter",
                    "gambling-ags",
                    "gambling-onlydomains",
                    "native.amazon",
                    "native.oppo-realme",
                    "native.tiktok.extended",
                    "native.tiktok",
                    "native.vivo",
                    "native.xiaomi"
                ],
                "domain_keyword": [
                    "data togel"
                ],
                "outbound": "🎯 Ads"
            },
            {
                "domain_suffix": [
                    "dailymotion.com",
                    "maki.my.id",
                    "kuramanime.run",
                    "filemoon.sx",
                    "mega.co.nz",
                    "ghbrisk.com"
                ],
                "rule_set": [
                    "geosite-youtube",
                    "geosite-openai",
                    "geosite-google",
                    "geoip-id"
                ],
                "inbound": [
                    "direct-in"
                ],
                "outbound": "🌐 Internet",
                "action": "route"
            },
            {
                "inbound": [
                    "direct-in"
                ],
                "rule_set": [
                    "geosite-wa"
                ],
                "domain_suffix": [
                    "wa.me",
                    "whatsapp-plus.info",
                    "whatsapp-plus.me",
                    "whatsapp-plus.net",
                    "whatsapp.cc",
                    "whatsapp.biz",
                    "whatsapp.com",
                    "whatsapp.info",
                    "whatsapp.net",
                    "whatsapp.org",
                    "whatsapp.tv",
                    "whatsappbrand.com",
                    "graph.whatsapp.com",
                    "graph.whatsapp.net"
                ],
                "domain": [
                    "graph.facebook.com"
                ],
                "domain_keyword": [
                    "whatsapp"
                ],
                "ip_cidr": [
                    "158.85.224.160/27",
                    "158.85.46.128/27",
                    "158.85.5.192/27",
                    "173.192.222.160/27",
                    "173.192.231.32/27",
                    "18.194.0.0/15",
                    "184.173.128.0/17",
                    "208.43.122.128/27",
                    "34.224.0.0/12",
                    "50.22.198.204/30",
                    "54.242.0.0/15"
                ],
                "outbound": "📞 Rule-WA",
                "ip_is_private": true
            },
            {
                "ip_is_private": true,
                "rule_set": "geoip-id",
                "outbound": "🌐 Internet"
            },
            {
                "rule_set": [
                    "geosite-facebook1",
                    "geosite-facebook3",
                    "facebook-dev",
                    "facebook-ipcidr",
                    "geosite-instagram",
                    "geosite-discord",
                    "geosite-tiktok",
                    "AS32934",
                    "Google-AS15169",
                    "google-ipcidr",
                    "google-scholar",
                    "speedtest",
                    "messenger"
                ],
                "inbound": [
                    "direct-in"
                ],
                "outbound": "🌐 Internet",
                "action": "route"
            }
        ],
        "rule_set": [
            {
                "type": "remote",
                "tag": "geosite-rule-ads",
                "format": "binary",
                "url": "https://github.com/dickymuliafiqri/sing-box-examples/releases/download/latest/geosite-rule-ads.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "Ads-Adaway",
                "format": "binary",
                "url": "https://github.com/Mayumiwandi/Lecilia/raw/refs/heads/main/Sing-box/adaway.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "Ads-Abpindo",
                "format": "binary",
                "url": "https://github.com/Mayumiwandi/Lecilia/raw/refs/heads/main/Sing-box/abpindo.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "pornholeindo",
                "format": "binary",
                "url": "https://github.com/Mayumiwandi/Lecilia/raw/refs/heads/main/Sing-box/pornholeindo.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "category-porn",
                "format": "binary",
                "url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/sing/geo/geosite/category-porn.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "geoip-id",
                "format": "binary",
                "url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/sing/geo/geoip/id.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "geosite-facebook1",
                "format": "binary",
                "url": "https://github.com/malikshi/sing-box-geo/raw/refs/heads/rule-set-geosite/geosite-facebook.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "geosite-facebook3",
                "format": "binary",
                "url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/sing/geo/geosite/facebook.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "facebook-dev",
                "format": "binary",
                "url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/sing/geo/geosite/facebook-dev.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "facebook-ipcidr",
                "format": "binary",
                "url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/sing/geo/geoip/facebook.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "geosite-instagram",
                "format": "binary",
                "url": "https://github.com/malikshi/sing-box-geo/raw/refs/heads/rule-set-geosite/geosite-instagram.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "messenger",
                "format": "binary",
                "url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/sing/geo/geosite/messenger.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "geosite-youtube",
                "format": "binary",
                "url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/sing/geo-lite/geosite/youtube.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "geosite-openai",
                "format": "binary",
                "url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/sing/geo-lite/geosite/openai.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "geosite-wa",
                "format": "binary",
                "url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/sing/geo/geosite/whatsapp.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "geosite-google",
                "format": "binary",
                "url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/sing/geo-lite/geosite/google.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "google-ipcidr",
                "format": "binary",
                "url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/sing/geo/geoip/google.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "geosite-discord",
                "format": "binary",
                "url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/sing/geo/geosite/discord.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "geosite-tiktok",
                "format": "binary",
                "url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/sing/geo-lite/geosite/tiktok.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "AS32934",
                "format": "binary",
                "url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/sing/asn/AS132934.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "Google-AS15169",
                "format": "binary",
                "url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/sing/asn/AS15169.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "google-scholar",
                "format": "binary",
                "url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/sing/geo/geosite/google-scholar.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "speedtest",
                "format": "binary",
                "url": "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/sing/geo/geosite/speedtest.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "GoodbyeAds-YouTube-AdBlock-Filter",
                "format": "binary",
                "url": "https://github.com/Mayumiwandi/Lecilia/raw/refs/heads/main/Sing-box/new/GoodbyeAds-YouTube-AdBlock-Filter.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "gambling-ags",
                "format": "binary",
                "url": "https://github.com/Mayumiwandi/Lecilia/raw/refs/heads/main/Sing-box/new/gambling-ags.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "gambling-onlydomains",
                "format": "binary",
                "url": "https://github.com/Mayumiwandi/Lecilia/raw/refs/heads/main/Sing-box/new/gambling-onlydomains.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "native.amazon",
                "format": "binary",
                "url": "https://github.com/Mayumiwandi/Lecilia/raw/refs/heads/main/Sing-box/new/native.amazon.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "native.oppo-realme",
                "format": "binary",
                "url": "https://github.com/Mayumiwandi/Lecilia/raw/refs/heads/main/Sing-box/new/native.oppo-realme.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "native.tiktok.extended",
                "format": "binary",
                "url": "https://github.com/Mayumiwandi/Lecilia/raw/refs/heads/main/Sing-box/new/native.tiktok.extended.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "native.tiktok",
                "format": "binary",
                "url": "https://github.com/Mayumiwandi/Lecilia/raw/refs/heads/main/Sing-box/new/native.tiktok.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "native.vivo",
                "format": "binary",
                "url": "https://github.com/Mayumiwandi/Lecilia/raw/refs/heads/main/Sing-box/new/native.vivo.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "native.xiaomi",
                "format": "binary",
                "url": "https://github.com/Mayumiwandi/Lecilia/raw/refs/heads/main/Sing-box/new/native.xiaomi.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "nsfw-onlydomains",
                "format": "binary",
                "url": "https://github.com/Mayumiwandi/Lecilia/raw/refs/heads/main/Sing-box/new/nsfw-onlydomains.srs",
                "download_detour": "🌐 Internet"
            },
            {
                "type": "remote",
                "tag": "porn-ags",
                "format": "binary",
                "url": "https://github.com/Mayumiwandi/Lecilia/raw/refs/heads/main/Sing-box/new/porn-ags.srs",
                "download_detour": "🌐 Internet"
            }
        ],
        "final": "🌐 Internet",
        "auto_detect_interface": true
    },
    "experimental": {
        "clash_api": {
            "external_controller": "0.0.0.0:9090",
            "external_ui": "dist",
            "external_ui_download_url": "https://github.com/Zephyruso/zashboard/releases/latest/download/dist-cdn-fonts.zip",
            "external_ui_download_detour": "🌐 Internet",
            "default_mode": "rule",
            "access_control_allow_origin": "*"
        }
    }
}
