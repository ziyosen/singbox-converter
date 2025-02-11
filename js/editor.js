function convertVmess(input) {
    try {
        const data = JSON.parse(atob(input.replace('vmess://', '')));
        if (!data.add || !data.port || !data.id) return null;

        const transport = {};
        if (data.net === 'ws' || data.net === 'h2' || data.net === 'grpc') {
            transport.type = data.net;
            if (data.path) transport.path = data.path;
            if (data.host) transport.headers = { Host: data.host };
            if (data.net === 'grpc' && data.path) transport.service_name = data.path.replace(/^\//, '');
        } else if (data.net === 'tcp' && data.type === 'http') {
            transport.type = 'http';
            if (data.host) transport.host = data.host.split(',');
            if (data.path) transport.path = data.path;
        } else if (data.net === 'kcp' || data.net === 'mkcp') {
            transport.type = 'mkcp';
            if (data.type === 'seed' && data.seed) transport.seed = data.seed;
            if (data.type === 'header' && data.headerType) transport.header = { type: data.headerType };
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
            packet_encoding: "xudp",
            tls: {
                enabled: data.tls === 'tls',
                insecure: true,
                server_name: data.sni || data.add,
                alpn: data.alpn ? data.alpn.split(',') : undefined
            }
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
        const encryption = params.get('encryption') || 'none';
        const flow = params.get('flow') || '';
        const security = url.password || 'tls';


        const transport = {};
        const type = params.get('type');
        if (type === 'ws' || type === 'h2' || type === 'grpc') {
            transport.type = type;
            if (params.get('path')) transport.path = params.get('path');
            if (params.get('host')) transport.headers = { Host: params.get('host') };
            if (type === 'grpc' && params.get('path')) transport.service_name = params.get('path').replace(/^\//, '');
        } else if (type === 'tcp' && params.get('headerType')) {
            transport.type = 'http';
            transport.header = { type: params.get('headerType') };
        }


        return {
            type: "vless",
            tag: `vless-${generateUUID().slice(0, 8)}`,
            server: address,
            server_port: parseInt(port),
            uuid: url.username,
            encryption: encryption !== 'none' ? encryption : undefined,
            flow: flow || undefined,
            transport: transport,
            packet_encoding: "xudp",
            tls: {
                enabled: security === 'tls',
                server_name: params.get('sni') || address,
                insecure: true,
                alpn: params.get('alpn') ? params.get('alpn').split(',') : undefined
            }
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
        if (type === 'ws' || type === 'h2' || type === 'grpc') {
            transport.type = type;
            if (params.get('path')) transport.path = params.get('path');
            if (params.get('host')) transport.headers = { Host: params.get('host') };
             if (type === 'grpc' && params.get('path')) transport.service_name = params.get('path').replace(/^\//, '');
        } else if (type === 'tcp' && params.get('headerType')) {
            transport.type = 'http';
            transport.header = { type: params.get('headerType') };
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
                alpn: (params.get('alpn') || '').split(',').filter(Boolean),
                fingerprint: params.get('fp') || undefined
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
            tls: {
                enabled: true,
                server_name: params.get('sni') || url.hostname,
                insecure: true,
                alpn: params.get('alpn') ? params.get('alpn').split(',') : undefined,
                fingerprint: params.get('fp') || undefined
            },
             recv_window_conn: params.get('recv_window_conn') ? parseInt(params.get('recv_window_conn')) : undefined,
             recv_window: params.get('recv_window') ? parseInt(params.get('recv_window')) : undefined,
             send_window_conn: params.get('send_window_conn') ? parseInt(params.get('send_window_conn')) : undefined,
             send_window: params.get('send_window') ? parseInt(params.get('send_window')) : undefined,
             max_idle_conns: params.get('max_idle_conns') ? parseInt(params.get('max_idle_conns')) : undefined,
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
        const params = new URLSearchParams(_);


        if (!server || !port) return null;

        return {
            type: "shadowsocks",
            tag: `ss-${generateUUID().slice(0, 8)}`,
            server: server,
            server_port: parseInt(port),
            method: method,
            password: password,
            plugin: params.get('plugin') || undefined,
            plugin_opts: Object.fromEntries(params.entries()) || undefined,
        };
    } catch (error) {
        throw new Error('Invalid Shadowsocks configuration');
    }
}

function convertWireGuard(input) {
    try {
        const url = new URL(input);
        if (url.protocol.toLowerCase() !== 'wg:' || !url.hostname) return null;

        const params = new URLSearchParams(url.search);
        const config = {};

        config.private_key = url.username;
        config.public_key = params.get('public_key');
        config.preshared_key = params.get('psk');
        config.server = url.hostname;
        config.server_port = parseInt(url.port) || 443;
        config.peers = [{
            public_key: params.get('peer_pub_key'),
            preshared_key: params.get('peer_psk'),
            allowed_ips: params.get('allowed_ips')?.split(',') || ["0.0.0.0/0", "::/0"],
            endpoint: params.get('peer_endpoint'),
        }];


        return {
            type: "wireguard",
            tag: `wg-${generateUUID().slice(0, 8)}`,
            config: config,
        };
    } catch (error) {
        throw new Error('Invalid WireGuard configuration');
    }
}
