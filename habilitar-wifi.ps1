$ErrorActionPreference = 'Stop'
if (-not (Get-NetFirewallRule -DisplayName 'Dentino WiFi local 3001' -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName 'Dentino WiFi local 3001' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3001 -RemoteAddress 192.168.18.0/24 -InterfaceAlias 'Wi-Fi' -Profile Any | Out-Null
}
