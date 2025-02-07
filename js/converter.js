function convertConfig() {
    const input = document.getElementById('input').value.trim();
    const errorDiv = document.getElementById('error');
    
    if (!input) {
        errorDiv.textContent = 'Please enter a proxy configuration';
        return;
    }
    
    startLoading();
    
    setTimeout(() => {
        try {
            let config;
            if (input.startsWith('vmess://')) {
                config = convertVmess(input);
            } else if (input.startsWith('vless://')) {
                config = convertVless(input);
            } else if (input.startsWith('trojan://')) {
                config = convertTrojan(input);
            } else if (input.startsWith('hysteria2://') || input.startsWith('hy2://')) {
                config = convertHysteria2(input);
            } else if (input.startsWith('ss://')) {
                config = convertShadowsocks(input);
            } else {
                throw new Error('Unsupported protocol');
            }
            
            const singboxConfig = createSingboxConfig(config);
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

function convertVmess(input) {
    try {
        const data = JSON.parse(atob(input.replace('vmess://', '')));
        return {
            type: "vmess",
            tag: `vmess-${generateUUID().slice(0, 8)}`,
            server: data.add,
            server_port: parseInt(data.port),
            uuid: data.id,
            security: data.scy || "auto",
            alter_id: parseInt(data.aid || 0),
            transport: createTransport(data),
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
        const address = url.hostname;
        const port = url.port || 443;
        const params = new URLSearchParams(url.search);
        return {
            type: "vless",
            tag: `vless-${generateUUID().slice(0, 8)}`,
            server: address,
            server_port: parseInt(port),
            uuid: url.username,
            flow: params.get('flow') || '',
            transport: createTransportFromParams(params),
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
        const params = new URLSearchParams(url.search);
        return {
            type: "trojan",
            tag: `trojan-${generateUUID().slice(0, 8)}`,
            server: url.hostname,
            server_port: parseInt(url.port || 443),
            password: url.username,
            transport: createTransportFromParams(params),
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

function createSingboxConfig(outbound) {
    return {
        dns: {
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
                }
            ]
        },
        inbounds: [
            {
                type: "mixed",
                listen: "127.0.0.1",
                listen_port: 2080
            }
        ],
        outbounds: [
            outbound,
            {
                type: "direct",
                tag: "direct"
            }
        ],
        route: {
            rules: [
                {
                    protocol: "dns",
                    outbound: "dns-out"
                }
            ]
        }
    };
}