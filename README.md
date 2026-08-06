# Inforcenter — Sistema de Hotspot (Login por CPF + Captação de Leads)

Sistema de Wi-Fi Hotspot da Inforcenter com dois fluxos de acesso, integração MikroTik e painel administrativo.

## Funcionalidades

- **Portal Hotspot** — página de login com identidade visual Inforcenter (dark + verde)
- **Login por CPF (clientes)** — quem já é assinante entra só com o CPF; a identificação é feita direto contra a API do IXC Soft, sem exigir senha
- **Captação de leads (visitantes)** — quem ainda não é cliente libera o acesso com nome + telefone (mesmo fluxo comercial do sistema da MG-NET SAL), servindo como porta de entrada para vendas
- **Integração MikroTik** — liberação automática de acesso via API RouterOS, com tempos de sessão diferentes para cliente x visitante
- **Painel Admin** — dashboard (com contagem de clientes x visitantes), gerenciamento de conexões, sessões ativas e configurações
- **Exportação CSV** — exporta a lista de clientes e leads para Excel

> **Roadmap:** fluxo de PIX para compra de pacotes extras e controle fino de tempo de conexão por cliente — combinado com o Adilson para uma próxima etapa, depois que o dono validar esta primeira versão.

---

## Requisitos do Servidor

- Linux (Ubuntu 20.04+ recomendado)
- Node.js 18+
- Acesso de rede ao MikroTik (porta 8728)
- Acesso à API do IXC Soft (mesma usada pelo app do assinante — `App-InforCenter`)

---

## Instalação Rápida

```bash
cd hotspot-inforcenter
sudo bash install.sh
```

---

## Configuração Manual

### 1. Instalar dependências

```bash
cd backend
npm install --production
```

### 2. Configurar variáveis de ambiente

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Preencha (veja `backend/.env.example` para a lista completa):

| Variável | Descrição |
|---|---|
| `PORT` | Porta do servidor (padrão: 3000) |
| `JWT_SECRET` | Chave secreta JWT (string aleatória longa) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Login inicial do painel admin |
| `IXC_BASE_URL` / `IXC_TOKEN` | Mesmos dados usados no app do assinante — identifica o CPF dos clientes |
| `OTP_ENABLED` | `1` exige código SMS para visitantes; `0` (padrão) libera direto com nome + telefone |
| `MIKROTIK_HOST` / `MIKROTIK_PORT` / `MIKROTIK_USER` / `MIKROTIK_PASSWORD` | Acesso à API do MikroTik |
| `HOTSPOT_FREE_TIME` | Minutos de acesso para visitantes (padrão 60) |
| `CLIENT_FREE_TIME` | Minutos de acesso para clientes autenticados por CPF (padrão 480) |

### 3. Iniciar o servidor

```bash
npm install -g pm2
pm2 start backend/src/app.js --name hotspot-inforcenter
pm2 save && pm2 startup

# Ou diretamente
node backend/src/app.js
```

### 4. Com Docker (alternativo)

```bash
cp backend/.env.example backend/.env
docker-compose up -d
```

### 5. Deploy no Coolify (produção)

1. Crie um novo recurso no Coolify apontando para este repositório (build pack **Dockerfile**, porta **3000**)
2. Configure as variáveis de ambiente (mesmas do `.env.example`, incluindo `IXC_BASE_URL`/`IXC_TOKEN`)
3. Adicione um **volume persistente** em `/app/backend/data` (banco SQLite)
4. Aponte um domínio (ex: `hotspot.inforcenterfibra.com.br`) com HTTPS

---

## Configuração MikroTik

Veja o arquivo `mikrotik/configurar-hotspot.rsc` para o passo a passo completo.

### Resumo:
1. Ative a API em **IP → Services → api** (porta 8728), restrita ao IP da VPS
2. Crie um usuário de API com grupo `api,read,write,test`
3. Configure o Hotspot em **IP → Hotspot** com `login-by=mac-cookie,http-pap`
4. Baixe o `login.html` já apontado para o roteador cadastrado (veja instruções na aba **MikroTiks** do painel admin) e envie para a pasta do hotspot no MikroTik, substituindo o `login.html` padrão
5. Adicione o domínio do portal ao **Walled Garden** (HTTP e IP/HTTPS)
6. O roteador Wi-Fi fica em modo AP burro: cabo na porta **LAN**, DHCP desativado — o MikroTik gerencia tudo

A identificação por CPF acontece inteiramente no backend (que consulta a API do IXC) — o MikroTik só recebe o comando final de liberar o acesso, então nenhuma configuração extra de walled garden é necessária para o login de clientes.

---

## Acesso

| URL | Descrição |
|---|---|
| `http://IP:3000/` | Portal hotspot (visto pelo cliente) |
| `http://IP:3000/admin` | Painel administrativo |

**Login padrão:** `admin` / `inforcenter@2026` — **Mude após o primeiro acesso!**

---

## Fluxo de Uso

```
Pessoa conecta ao Wi-Fi
        ↓
MikroTik redireciona para o portal
        ↓
        ├── É cliente Inforcenter? → informa o CPF (identificado no IXC) → acesso liberado
        │
        └── Ainda não é cliente?  → nome + telefone → acesso liberado (lead comercial)
        ↓
Sistema autoriza o usuário no MikroTik via API
        ↓
Acesso à internet liberado (tempo configurável por tipo de usuário)
```

---

## Demonstração (GitHub Pages)

O conteúdo de `public/` é publicado automaticamente no GitHub Pages a cada push na `main` (veja `.github/workflows/deploy.yml`). É uma **demo estática** — o frontend detecta que está em `github.io` e simula as respostas da API (nenhum dado real é enviado ou validado). Serve para mostrar a tela para o dono da Inforcenter antes de subir em produção.

---

## Suporte Técnico

**Inforcenter** — Vale do Jequitinhonha, MG
WhatsApp: (33) 98813-4583
