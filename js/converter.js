function createSingboxConfig(outbounds, validTags) {
    return {
        dns: {
            servers: [
                {
                    tag: "remote-dns",
                    address: "tls://1.1.1.1",
                    address_resolver: "local-dns",
                    strategy: "ipv4_only"
                },
                {
                    tag: "local-dns",
                    address: "local",
                    detour: "direct"
                }
            ],
            rules: [
                {
                    domain_suffix: [".ir"],
                    server: "local-dns"
                },
                {
                    rule_set: ["geosite-category-ads-all"],
                    server: "block"
                }
            ]
        },
        route: {
            rule_set: [
                {
                    tag: "geoip-ir",
                    type: "remote",
                    format: "binary",
                    url: "https://raw.githubusercontent.com/Chocolate4U/Iran-sing-box-rules/rule-set/geoip-ir.srs",
                    download_detour: "direct"
                },
                {
                    tag: "geosite-ir",
                    type: "remote",
                    format: "binary",
                    url: "https://raw.githubusercontent.com/Chocolate4U/Iran-sing-box-rules/rule-set/geosite-ir.srs",
                    download_detour: "direct"
                }
            ],
            rules: [
                {
                    rule_set: ["geoip-ir", "geosite-ir"],
                    outbound: "direct"
                }
            ]
        }
    };
}