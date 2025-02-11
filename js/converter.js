function convertConfig() {
    const input = document.getElementById('input').value.trim();
    const errorDiv = document.getElementById('error');
    
    if (!input) {
        errorDiv.textContent = 'لطفا کانفیگ‌های پروکسی را وارد کنید';
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
                } else if (config.startsWith('wireguard://')) {
                    converted = convertWireGuard(config);
                } else {
                    continue;
                }
                
                if (converted) {
                    outbounds.push(converted);
                    validTags.push(converted.tag);
                }
            }
            
            if (outbounds.length === 0) {
                throw new Error('هیچ کانفیگ معتبری یافت نشد');
            }
            
            const singboxConfig = createSingboxConfig(outbounds, validTags);
            const jsonString = JSON.stringify(singboxConfig, null, 2);
            editor.setValue(jsonString);
            editor.clearSelection();
            errorDiv.textContent = '';
            stopLoading();
        } catch (error) {
            errorDiv.textContent = 'خطا: ' + error.message;
            editor.setValue('');
            stopLoading();
        }
    }, 2000);
}

function createSingboxConfig(outbounds, validTags) {
    const settings = {
        mtu: parseInt(document.getElementById('mtu').value) || 1500,
        mainDns: document.getElementById('main-dns').value || 'local',
        altDns: document.getElementById('alt-dns').value || 'tls://1.1.1.1',
        ruleSetUrl: document.getElementById('ruleset-url').value
    };

    return {
        dns: {
            servers: [
                {
                    tag: "remote-dns",
                    address: settings.altDns,
                    address_resolver: "local-dns",
                    strategy: "ipv4_only"
                },
                {
                    tag: "local-dns",
                    address: settings.mainDns,
                    detour: "direct"
                }
            ],
            rules: [
                {
                    domain_suffix: [".ir", ".co.ir", ".org.ir"],
                    server: "local-dns"
                },
                {
                    rule_set: ["geosite-category-ads-all"],
                    server: "block"
                }
            ]
        },
        inbounds: [
            {
                type: "tun",
                tag: "tun-in",
                interface_name: "sing-box",
                mtu: settings.mtu,
                domain_strategy: "prefer_ipv4",
                stack: "mixed",
                auto_route: true,
                sniff: true,
                sniff_override_destination: true,
                route_address: ["0.0.0.0/0", "::/0"],
                excluded_address: ["239.255.255.250/32"]
            }
        ],
        outbounds: [
            {
                type: "selector",
                tag: "proxy",
                outbounds: ["auto"].concat(validTags),
                default: "auto",
                interrupt_exist_connections: false
            },
            {
                type: "urltest",
                tag: "auto",
                outbounds: validTags,
                url: "https://www.gstatic.com/generate_204",
                interval: "10m",
                tolerance: 50
            },
            ...outbounds,
            {
                type: "direct",
                tag: "direct",
                domain_strategy: "ipv4_only"
            }
        ],
        route: {
            rule_set: [
                {
                    tag: "geoip-ir",
                    type: "remote",
                    format: "binary",
                    url: settings.ruleSetUrl,
                    download_detour: "direct"
                }
            ],
            rules: [
                {
                    rule_set: "geoip-ir",
                    outbound: "direct"
                },
                {
                    protocol: "dns",
                    outbound: "dns-out"
                }
            ],
            final: "proxy",
            auto_detect_interface: true
        },
        experimental: {
            cache_file: {
                enabled: true,
                path: "cache.db",
                cache_id: "sing-box-ir"
            }
        }
    };
}