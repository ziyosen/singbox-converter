function convertConfig() {
    const input = document.getElementById('input').value.trim();
    const errorDiv = document.getElementById('error');
    
    if (!input) {
        errorDiv.textContent = 'Please enter a proxy configuration';
        return;
    }
    
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
        typeText(jsonString, 'editor');
        errorDiv.textContent = '';
    } catch (error) {
        errorDiv.textContent = error.message;
        editor.setValue('');
    }
}

function createSingboxConfig(outbound) {
    return {
        "dns": {
            "servers": [
                {
                    "address": "tls://208.67.222.123",
                    "address_resolver": "local-dns",
                    "detour": "proxy",
                    "tag": "proxy-dns"
                },
                {
                    "address": "local",
                    "detour": "direct",
                    "tag": "local-dns"
                }
            ]
        },
        "inbounds": [
            {
                "type": "mixed",
                "listen": "127.0.0.1",
                "listen_port": 2080
            }
        ],
        "outbounds": [
            outbound,
            {
                "type": "direct",
                "tag": "direct"
            }
        ],
        "route": {
            "rules": [
                {
                    "protocol": "dns",
                    "outbound": "dns-out"
                }
            ]
        }
    };
}