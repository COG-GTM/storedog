#!/bin/sh
# Fail on any error
set -e

# Use 127.0.0.11 as the default resolver for Docker Compose
export NGINX_RESOLVER=${NGINX_RESOLVER:-127.0.0.11}
# Set the default ADS_A_UPSTREAM to the Java ads service
export ADS_A_UPSTREAM=${ADS_A_UPSTREAM:-ads:3030}

# Calculate upstream config based on ADS_B_PERCENT
ADS_B_PERCENT=${ADS_B_PERCENT:-0}

if [ -z "$ADS_B_PERCENT" ] || [ "$ADS_B_PERCENT" -eq 0 ]; then
    # No A/B testing: use variable-based proxy_pass to defer DNS resolution
    # so nginx can start even when the ads service is not yet available.
    ADS_UPSTREAM_BLOCKS=""
    ADS_PROXY_CONFIG='set $upstream_ads "http://'"${ADS_A_UPSTREAM}"'/";
        proxy_pass $upstream_ads;'
else
    ADS_B_UPSTREAM=${ADS_B_UPSTREAM:-ads-python:3030}
    ADS_A_WEIGHT=$((100 - ADS_B_PERCENT))
    ADS_B_WEIGHT=$ADS_B_PERCENT
    ADS_UPSTREAM_BLOCKS="upstream ads_service_a {
    server ${ADS_A_UPSTREAM} max_fails=1 fail_timeout=1s;
}

upstream ads_service_b {
    server ${ADS_B_UPSTREAM} max_fails=1 fail_timeout=1s;
}

upstream ads_upstream {
    server ${ADS_A_UPSTREAM} weight=${ADS_A_WEIGHT};
    server ${ADS_B_UPSTREAM} weight=${ADS_B_WEIGHT};
}"
    ADS_PROXY_CONFIG="proxy_pass http://ads_upstream/;"
fi

export ADS_UPSTREAM_BLOCKS
export ADS_PROXY_CONFIG

# Substitute all relevant variables in the template and output the final config
envsubst '$NGINX_RESOLVER $ADS_UPSTREAM_BLOCKS $ADS_PROXY_CONFIG' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Start NGINX in the foreground
exec nginx -g 'daemon off;'
