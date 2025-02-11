function convertVmess(input) {
    try {
        const data = JSON.parse(atob(input.replace('vmess://', '')));
        if (!data.add || !data.port || !data.id) return null;
        
        const transport = {};
        if (data.net === 'ws' || data.net === 'http') {
            transport.type = data.net;
            transport.path = data.path || "/";
            if(data.host) transport.headers = { Host: data.host };
            if(data.path?.includes('?ed=')) transport.early_data_header_name = "Sec-WebSocket-Protocol";
        }

        return {
            type: "vmess",
            tag: `vmess-${generateUUID().slice(0,8)}`,
            server: data.add,
            server_port: parseInt(data.port),
            uuid: data.id,
            security: data.scy || "auto",
            alter_id: parseInt(data.aid || 0),
            transport: Object.keys(transport).length > 0 ? transport : undefined,
            tls: createTlsSettings(data),
            multiplex: createMultiplex(data)
        };
    } catch (error) {
        throw new Error('Invalid VMess configuration');
    }
}

function convertVless(input) {
    try {
        const url = new URL(input);
        const params = new URLSearchParams(url.search);
        
        const transport = {
            type: params.get('type') || 'tcp',
            path: params.get('path'),
            headers: params.get('host') ? {Host: params.get('host')} : undefined
        };

        return {
            type: "vless",
            tag: `vless-${generateUUID().slice(0,8)}`,
            server: url.hostname,
            server_port: parseInt(url.port || 443),
            uuid: url.username,
            flow: params.get('flow') || '',
            transport: transport.type !== 'tcp' ? transport : undefined,
            tls: createTlsSettings(params),
            multiplex: createMultiplex(params)
        };
    } catch (error) {
        throw new Error('Invalid VLESS configuration');
    }
}

function convertWireGuard(input) {
    try {
        const url = new URL(input);
        const params = new URLSearchParams(url.search);
        
        return {
            type: "wireguard",
            tag: `wg-${generateUUID().slice(0,8)}`,
            server: url.hostname,
            server_port: parseInt(url.port || 51820),
            system_interface: false,
            interface_name: "wg0",
            local_address: [
                params.get('address') || '10.0.0.2/32'
            ],
            private_key: url.username,
            peers: [
                {
                    public_key: params.get('public_key'),
                    pre_shared_key: params.get('preshared_key'),
                    allowed_ips: params.getAll('allowed_ips') || ['0.0.0.0/0'],
                    endpoint: `${params.get('endpoint')}:${params.get('endpoint_port') || 51820}`
                }
            ]
        };
    } catch (error) {
        throw new Error('Invalid WireGuard configuration');
    }
}

function createTlsSettings(params) {
    const tls = {
        enabled: params.get('security') === 'tls',
        server_name: params.get('sni'),
        insecure: params.get('allow_insecure') === '1'
    };
    
    if(params.get('alpn')) tls.alpn = params.get('alpn').split(',');
    if(params.get('fp')) tls.utls = { fingerprint: params.get('fp') };
    
    return tls.enabled ? tls : undefined;
}

function createMultiplex(params) {
    if(params.get('mux') === '1') {
        return {
            enabled: true,
            protocol: "smux",
            max_connections: parseInt(params.get('mux_max_conn') || 4),
            min_streams: parseInt(params.get('mux_min_stream') || 4)
        };
    }
    return undefined;
}