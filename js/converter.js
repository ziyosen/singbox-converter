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
                    converted = convertWireGuard(config);
                }
                else {
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
        log: {
            level: "info",
            timestamp: true,
            component: true
        },
        dns: {
            hijack_mode: "redir",
            rules: [
                {
                    geosite: "category-ads-all",
                    server: "block"
                },
                {
                    ip_cidr: ["192.168.0.0/16", "10.0.0.0/8", "172.16.0.0/12", "fd00::/8", "fe80::/10"],
                    server: "direct"
                },
                {
                    clash_mode: "Direct",
                    server: "direct"
                },
                {
                    clash_mode: "Global",
                    server: "proxy"
                }
            ],
            servers: [
                {
                    tag: "local",
                    address: "local"
                },
                {
                    tag: "block",
                    address: "rcode://success"
                },
                {
                    tag: "proxy",
                    address: "tls://dns.google",
                    tls: {
                        sni: "dns.google"
                    },
                    detour: "proxy"
                },
                {
                    tag: "direct",
                    address: "tcp+local://1.1.1.1"
                }
            ],
            final: "local"
        },
        inbounds: [
            {
                type: "mixed",
                tag: "mixed-in",
                listen: "127.0.0.1",
                listen_port: 10808,
                sniff: [
                    "http",
                    "tls"
                ],
                allocate_strategy: "always",
                users: []
            }
        ],
        outbounds: [
            {
                tag: "proxy",
                type: "selector",
                outbounds: [
                    "auto",
                    "direct",
                    ...validTags
                ]
            },
            {
                tag: "auto",
                type: "latency",
                outbounds: validTags,
                url: "https://www.gstatic.com/generate_204",
                interval: "5m",
                tolerance: 100
            },
            {
                tag: "direct",
                type: "direct"
            },
            ...outbounds
        ],
        route: {
            final: "proxy",
            rules: [
                {
                    geosite: "cn",
                    outbound: "direct"
                },
                {
                    domain: [
                        "sing-box.sagernet.org",
                        "github.com",
                        "raw.githubusercontent.com"
                    ],
                    outbound: "direct"
                }
            ],
            auto_detect_interface: true
        }
    };
}
