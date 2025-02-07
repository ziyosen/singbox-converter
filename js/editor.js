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