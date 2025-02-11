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
                throw new Error('No valid configurations found');
            }
            
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
            servers: [
                {
                    tag: "remote-dns",
                    address: "tls://1.1.1.1",
                    address_resolver: "local-dns",
                    strategy: "prefer_ipv4"
                },
                {
                    tag: "local-dns", 
                    address: "local",
                    detour: "direct"
                }
            ],
            rules: [
                {
                    domain_suffix: [".cn"],
                    server: "local-dns"
                }
            ]
        },
        inbounds: [
            {
                type: "tun",
                tag: "tun-in",
                interface_name: "sing-box",
                mtu: 1500,
                stack: "mixed",
                auto_route: true,
                strict_route: false,
                endpoint_independent_nat: true,
                domain_strategy: "prefer_ipv4",
                domain_rule: [
                    "geosite:category-ads-all"
                ],
                sniff: true,
                sniff_override_destination: true,
                route_address: [
                    "0.0.0.0/0",
                    "::/0"
                ],
                excluded_address: [
                    "239.255.255.250/32"
                ]
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
                domain_strategy: "prefer_ipv4"
            },
            {
                type: "dns",
                tag: "dns-out"
            }
        ],
        route: {
            rule_set: [
                {
                    tag: "geoip-cn",
                    type: "remote",
                    format: "binary",
                    url: "https://raw.githubusercontent.com/SagerNet/sing-geoip/rule-set/geoip-cn.srs",
                    download_detour: "direct"
                }
            ],
            rules: [
                {
                    rule_set: "geoip-cn",
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
                cache_id: "sing-box"
            }
        }
    };
}