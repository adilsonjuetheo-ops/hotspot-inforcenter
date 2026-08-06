# =============================================================
# Configuração do Hotspot Inforcenter no MikroTik (RouterOS 6/7)
# Execute estes comandos no Terminal do MikroTik (New Terminal)
#
# ANTES DE COMEÇAR, substitua nos comandos abaixo:
#   PORTAL_DOMINIO  -> domínio do portal (ex: hotspot.inforcenterfibra.com.br)
#   IP_VPS          -> IP público da VPS onde o backend roda
#   SENHA_API       -> senha forte para o usuário da API
#   ETHER_HOTSPOT   -> interface onde o roteador Wi-Fi está ligado (ex: ether2)
#
# ARQUITETURA:
#   Internet -> MikroTik (hotspot/NAT/DHCP) -> Roteador Wi-Fi em modo AP burro
#   O roteador Wi-Fi deve ser ligado pela porta LAN (NÃO usar a porta WAN),
#   com o DHCP dele DESATIVADO — quem entrega IP e controla tudo é o MikroTik.
#
# LOGIN POR CPF: a identificação do CPF do cliente acontece no BACKEND
# (que consulta a API do IXC) — o MikroTik só recebe o comando final de
# liberar o acesso, igual ao fluxo de visitante. Nenhum ajuste extra de
# walled garden é necessário para isso.
# =============================================================

# 1. HABILITAR A API — restrita ao IP da VPS (segurança: IP público!)
/ip service set api disabled=no port=8728 address=IP_VPS/32
/ip service set api-ssl disabled=no port=8729 address=IP_VPS/32

# 2. CRIAR GRUPO E USUÁRIO PARA A API (sem acesso total)
/user group add name=hotspot-api policy=api,read,write,test comment="Grupo API Hotspot"
/user add name=hotspot-api password=SENHA_API group=hotspot-api comment="Usuario API Hotspot Inforcenter"

# 3. PERFIL DE USUÁRIO PADRÃO DO HOTSPOT
/ip hotspot user profile add name="inforcenter-default" \
  session-timeout=8h \
  idle-timeout=10m \
  shared-users=1 \
  rate-limit="10M/10M" \
  add-mac-cookie=yes \
  mac-cookie-timeout=3d

# 4. CONFIGURAR O SERVIDOR HOTSPOT (assistente)
#    Execute e siga o passo a passo:
/ip hotspot setup
#    - Interface: ETHER_HOTSPOT (porta onde o roteador Wi-Fi está ligado)
#    - IP da rede hotspot: 192.168.10.1/24 (masquerade: yes)
#    - Pool DHCP: 192.168.10.10-192.168.10.250
#    - Certificado: none
#    - SMTP: 0.0.0.0
#    - DNS: 8.8.8.8,8.8.4.4
#    - DNS name: wifi.inforcenterfibra.local (ou deixe em branco)
#    - Nome do servidor criado: anote (geralmente "hotspot1")

# 5. AJUSTAR O PERFIL DO HOTSPOT
#    login-by=http-pap é necessário para o login automático vindo do portal externo.
#    mac-cookie faz quem já se cadastrou reconectar sem ver o portal de novo.
/ip hotspot profile set [find name~"hsprof"] \
  login-by=mac-cookie,http-pap \
  http-cookie-lifetime=1d \
  use-radius=no
/ip hotspot set [find] profile=[/ip hotspot profile get [find name~"hsprof"] name] \
  addresses-per-mac=1

# 6. PÁGINA DE REDIRECIONAMENTO PARA O PORTAL EXTERNO
#    Baixe já apontada para o roteador cadastrado (veja o painel admin, aba MikroTiks):
#      /tool fetch url="https://PORTAL_DOMINIO/mikrotik-login/N" dst-path=hotspot/login.html
#    (troque N pelo número do roteador cadastrado no painel)

# 7. WALLED GARDEN — liberar o portal ANTES do login
/ip hotspot walled-garden add dst-host=PORTAL_DOMINIO comment="Portal Inforcenter (HTTP)"
/ip hotspot walled-garden ip add action=accept dst-host=PORTAL_DOMINIO comment="Portal Inforcenter (HTTPS)"

# 8. VERIFICAR SE O HOTSPOT ESTÁ ATIVO
/ip hotspot print
/ip hotspot profile print

# =============================================================
# NO BACKEND (.env / variáveis no Coolify), configure:
#   MIKROTIK_HOST=IP público do MikroTik
#   MIKROTIK_PORT=8728
#   MIKROTIK_USER=hotspot-api
#   MIKROTIK_PASSWORD=SENHA_API
#   MIKROTIK_HOTSPOT_SERVER=hotspot1  (nome anotado no passo 4)
#   IXC_BASE_URL / IXC_TOKEN         (mesmos dados do app do assinante)
# =============================================================

# =============================================================
# VERIFICAÇÕES ÚTEIS
# =============================================================
# Usuários criados pelo sistema:   /ip hotspot user print
# Sessões ativas:                  /ip hotspot active print
# Walled garden:                   /ip hotspot walled-garden print
# Testar API da VPS:               telnet IP_MIKROTIK 8728
# Logs do hotspot:                 /log print where topics~"hotspot"
