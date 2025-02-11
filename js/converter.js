function convertConfig() {
    const input = document.getElementById('input').value.trim();
    const errorDiv = document.getElementById('error');
    const tunModeEnabled = document.getElementById('tunModeButton').classList.contains('active');

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

            const singboxConfig = createSingboxConfig(outbounds, validTags, tunModeEnabled);
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

function createSingboxConfig(outbounds, validTags, tunModeEnabled) {
    const config = {
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

    if (tunModeEnabled) {
        config.inbounds.unshift({
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
        });
    }


    return config;
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
            tls: { enabled: data.tls === 'tls', insecure: true, server_name: data.sni || data.add }
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
            tls: { enabled: true, server_name: params.get('sni') || address, insecure: true }
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
