# FinControl — Manual Avançado

> Versão do app: v3 · Atualizado em junho de 2025  
> Para desenvolvedores, usuários avançados e futuras sessões no Claude Code.

---

## Índice

1. [Visão geral da arquitetura](#1-visão-geral-da-arquitetura)
2. [Estrutura de dados (schema completo)](#2-estrutura-de-dados-schema-completo)
3. [Design system — cores, tipografia, espaçamento](#3-design-system)
4. [Dashboard Web — telas e funções](#4-dashboard-web)
5. [App Mobile — páginas e funções](#5-app-mobile)
6. [Sincronização e Drive](#6-sincronização-e-drive)
7. [Criptografia E2E](#7-criptografia-e2e)
8. [PWA e Service Worker](#8-pwa-e-service-worker)
9. [Como adicionar uma nova tela](#9-como-adicionar-uma-nova-tela)
10. [Como adicionar um campo novo em lançamentos](#10-como-adicionar-um-campo-novo-em-lançamentos)
11. [Como adicionar uma nova categoria de dado](#11-como-adicionar-uma-nova-categoria-de-dado)
12. [Como alterar o design](#12-como-alterar-o-design)
13. [Como gerar um novo relatório PDF](#13-como-gerar-um-novo-relatório-pdf)
14. [Referência completa de funções](#14-referência-completa-de-funções)
15. [Fluxos críticos passo a passo](#15-fluxos-críticos-passo-a-passo)
16. [Checklist antes de publicar uma mudança](#16-checklist-antes-de-publicar-uma-mudança)

---

## 1. Visão geral da arquitetura

O FinControl é composto por **dois arquivos HTML standalone** — cada um contém HTML, CSS e JavaScript completamente inline, sem dependências de build ou servidor.

```
fincontrol/
├── fincontrol-dashboard.html   ← App desktop (~4.200 linhas)
├── fincontrol-mobile.html      ← App mobile PWA (~3.000 linhas)
├── manifest.json               ← Configuração PWA (ícones, shortcuts)
├── service-worker.js           ← Cache offline + push notifications
├── chart.umd.min.js            ← Chart.js 4.4.0 (local, sem CDN)
├── icon.svg                    ← Ícone do app
├── handoff.md                  ← Contexto técnico para Claude Code
└── manual-avancado.md          ← Este arquivo
```

### Como os dados fluem

```
Usuário interage
      ↓
Função JS (saveTx, saveAccount, etc.)
      ↓
Objeto global D é atualizado
      ↓
save() → localStorage['fincontrol_v3_userId']
      ↓
BroadcastChannel → outras abas abertas atualizam
      ↓ (após 1,5s de debounce)
_driveSync() → Google Drive (se conectado)
```

### Princípio de funcionamento

Não existe banco de dados, servidor ou API proprietária. Tudo vive em:

- **`D`** — objeto JavaScript global que guarda todos os dados do usuário em memória
- **`localStorage`** — onde `D` é serializado e persistido no browser
- **Google Drive** — backup opcional em JSON criptografado (AES-GCM 256-bit)

---

## 2. Estrutura de dados (schema completo)

A chave do localStorage é `fincontrol_v3_[userId]` onde `userId` é o ID da conta Google.

```js
D = {
  meta: {
    version: 3,
    lastSync: "2025-06-15T14:00:00.000Z",   // ISO — última sync
    driveFileId: null,                        // ID do arquivo no Drive
    rates: { USD: 0.177, EUR: 0.163, ... },  // Taxas de câmbio (cache 1h)
    ratesUpdated: "2025-06-15T12:00:00.000Z",
    savingsGoals: {},                         // Progresso mensal das metas
    dashConfig: {                             // Quais blocos mostrar no dashboard
      kpis: true, charts: true, widgets: true, table: true, alerts: true
    },
    homeConfig: {                             // Quais blocos mostrar no mobile home
      balance: true, minirow: true, quickact: true,
      flowchart: true, budgets: true, recent: true
    }
  },

  categories: {
    income:  ["Salário", "Comissão", "Benefício refeição", "Outros rendimentos"],
    expense: ["Alimentação", "Transporte", "Moradia", "Saúde", "Lazer", ...],
    card:    ["Alimentação", "Transporte", "Saúde", "Lazer", ...]
  },

  accounts: [
    {
      id: "uuid",           // crypto.randomUUID()
      name: "Nubank",
      bank: "Nubank",
      balance: 3200.00,     // saldo atual (atualizado a cada lançamento)
      type: "checking",     // "checking" | "savings" | "cash" | "investment"
      color: "#820ad1",     // hex — cor do card
      currency: "BRL"       // "BRL" | "USD" | "EUR" | "GBP" | "ARS" | ...
    }
  ],

  cards: [
    {
      id: "uuid",
      name: "Nubank",
      limit: 8000,
      closing: 1,           // dia de fechamento da fatura
      due: 8,               // dia de vencimento
      color: "#820ad1"
    }
  ],

  budgets: [
    {
      id: "uuid",
      category: "Alimentação",
      limit: 600             // valor máximo mensal em BRL
    }
  ],

  goals: [
    {
      id: "uuid",
      name: "Reserva de emergência",
      target: 30000,
      current: 11700,
      deadline: "2025-12-31",
      icon: "🛡"
    }
  ],

  recurrents: [             // campo canônico (mobile) — dashboard adapta para .recurring
    {
      id: "uuid",
      desc: "Salário",
      type: "income",       // "income" | "expense" | "card"
      cat: "Salário",
      amount: 8500,
      day: 5,               // dia do mês para lançar
      variable: false,      // se true, pede confirmação do valor todo mês
      active: true,
      cardId: null,
      accountId: "uuid"
    }
  ],

  transactions: [
    {
      id: "uuid",
      type: "income",       // "income" | "expense" | "card" | "transfer"
      desc: "Salário",
      amount: 8500,
      date: "2025-06-05",   // YYYY-MM-DD (armazenado) — exibido como "5 Jun 2025"
      cat: "Salário",
      cardId: null,
      accountId: "uuid",
      installments: 1,
      installCurrent: null, // parcela atual (ex: 2) — só em parcelamentos
      installTotal: null,   // total de parcelas (ex: 3)
      seriesId: null,       // ID do grupo de parcelas
      recurrentId: null,    // ID do recorrente que gerou este lançamento
      note: "",             // observação livre (campo adicionado em jun/2025)
      skipped: false        // true se o recorrente foi pulado no mês
    }
  ],

  investments: [
    {
      id: "uuid",
      name: "CDB Banco Inter",
      type: "Renda Fixa",   // tipo livre — texto
      amount: 15000,        // valor atual
      returnPct: 12.5,      // rentabilidade % a.a.
      dividends: [
        { date: "2025-04-15", amount: 120, note: "" }
      ],
      operations: [
        {
          id: "uuid",
          type: "aporte",   // "aporte" | "resgate" | "dividendo"
          date: "2024-01-15",
          amount: 15000,
          note: "Abertura"
        }
      ]
    }
  ]
}
```

### Tipos de transação

| `type` | Descrição | Efeito no saldo |
|--------|-----------|-----------------|
| `income` | Receita | `account.balance += amount` |
| `expense` | Despesa | `account.balance -= amount` |
| `card` | Gasto no cartão | Não afeta saldo — aparece na fatura |
| `transfer` | Transferência | `fromAccount.balance -= amount` / `toAccount.balance += amount` |

---

## 3. Design System

### Paleta de cores (CSS Custom Properties)

```css
/* Fundos — escala de escuros */
--bg:  #0a0a0a   /* fundo da página */
--s1:  #111111   /* cards, sidebar */
--s2:  #191919   /* inputs, hover */
--s3:  #212121   /* elementos internos */
--s4:  #2a2a2a   /* bordas internas */
--bd:  #2c2c2c   /* borda padrão */
--bd2: #3a3a3a   /* borda hover */

/* Texto */
--tx:  #f0f0f0   /* texto principal */
--tm:  #6b6b6b   /* texto secundário */
--td:  #3d3d3d   /* texto muito apagado */

/* Cores semânticas */
--cu:  #b87333   /* copper — marca, CTAs, destaques */
--cu-s: rgba(184,115,51,.12)  /* copper suave — backgrounds */
--cu-b: rgba(184,115,51,.35)  /* copper — bordas */
--gn:  #34c77b   /* verde — receitas, positivo */
--rd:  #d95f5f   /* vermelho — despesas, negativo, perigo */
--bl:  #4f8ef7   /* azul — cartão, metas */
--vt:  #8b7cf8   /* violeta — investimentos, patrimônio */
--am:  #e8a838   /* âmbar — aviso, variável */
```

### Temas disponíveis

O dashboard tem 5 temas que substituem a variável `--cu`:

| Tema | Cor primária | `data-theme` |
|------|-------------|--------------|
| Copper (padrão) | `#b87333` | `copper` |
| Azul | `#4f8ef7` | `azul` |
| Violeta | `#8b7cf8` | `violeta` |
| Esmeralda | `#2ec98a` | `esmeralda` |
| Magenta | `#d946ef` | `magenta` |

Para ativar: `document.documentElement.setAttribute('data-theme', 'azul')`

### Classes CSS reutilizáveis

```css
/* Dashboard */
.card          /* card branco escuro com borda */
.kpi           /* card de KPI com label + valor grande */
.kpi-val.gn    /* valor em verde */
.kpi-val.rd    /* valor em vermelho */
.btn           /* botão secundário */
.btn.pri       /* botão primário (copper) */
.btn.danger    /* botão vermelho */
.badge.income  /* tag verde "Receita" */
.badge.expense /* tag vermelha "Despesa" */
.badge.card    /* tag azul "Cartão" */
.modal         /* container de modal */
.ov            /* overlay escuro */
.ov.open       /* overlay visível */
.fi            /* input padrão */
.fs            /* select padrão */
.fl            /* label de campo */
.fg            /* field group (label + input) */
.fg-row        /* dois fields lado a lado */

/* Mobile */
.sheet         /* bottom sheet */
.ov.open       /* overlay visível */
.fbtn          /* full-width button */
.fbtn.sec      /* botão secundário */
.nav-item      /* tab da navbar */
.nav-item.active /* tab ativa */
.tx            /* card de transação */
.tx-ico        /* ícone colorido do tipo */
.chip          /* botão filtro */
.chip.active   /* filtro ativo */
```

### Tipografia

```css
--font: 'Inter', -apple-system, 'Segoe UI', sans-serif
--mono: 'JetBrains Mono', 'Consolas', monospace

/* Números financeiros — sempre usar: */
font-variant-numeric: tabular-nums
```

### Espaçamento

```css
--r:    11px   /* border-radius padrão */
--r-sm:  7px   /* border-radius pequeno */
--r-lg: 16px   /* border-radius modais */
--sb:  220px   /* largura da sidebar (dashboard) */
--top:  52px   /* altura da topbar (dashboard) */
```

---

## 4. Dashboard Web

### Telas disponíveis

| ID | Nome | Função que renderiza |
|----|------|---------------------|
| `sc-dashboard` | Dashboard | `renderDash()` |
| `sc-transactions` | Lançamentos | `renderTx()` |
| `sc-recurring` | Recorrentes | `renderRecurring()` |
| `sc-import` | Importar Extrato | `renderImportPreview()` |
| `sc-accounts` | Contas | `renderAccounts()` |
| `sc-budgets` | Orçamentos | `renderBudgets()` |
| `sc-goals` | Metas | `renderGoals()` |
| `sc-cards` | Cartões | `renderCards()` |
| `sc-investments` | Investimentos | `renderInvestments()` |
| `sc-annual` | Visão Anual | `renderAnnual()` |
| `sc-settings` | Configurações | `renderSettings()` |

### Navegação

```js
// Ir para uma tela:
goTo('transactions', btn)   // btn é o elemento clicado na sidebar

// Render dispara a tela ativa:
function render() {
  switch(curSc) {
    case 'dashboard':     renderDash(); break;
    case 'transactions':  renderTx();   break;
    // ...
  }
}
```

### Estado global do dashboard

```js
let D = {}            // objeto de dados (schema acima)
let curM = 5          // mês atual (0-11)
let curY = 2025       // ano atual
let curSc = 'dashboard'  // tela ativa
let selType = 'expense'  // tipo de lançamento selecionado
let txFilt = 'all'    // filtro de tipo na tabela de lançamentos
let flowMonths = 6    // quantos meses no gráfico de fluxo
let annualYear = 2025 // ano exibido na visão anual
let charts = {}       // instâncias Chart.js { flow, dist, acc, ... }
```

### Funções principais do dashboard

#### `save()`
Salva `D` no localStorage, atualiza `lastSync`, faz broadcast para outras abas e agenda sync com o Drive.

```js
const save = () => {
  D.recurrents = D.recurring.map(...);  // mantém recurrents em sync
  localStorage.setItem(KEY, JSON.stringify(D));
  D.meta.lastSync = new Date().toISOString();
  if(_bc) _bc.postMessage({type:'sync', key:KEY, d:D});
  // agenda Drive sync com debounce de 1,5s
  clearTimeout(save._syncTimer);
  save._syncTimer = setTimeout(() => _driveSync(), 1500);
};
```

#### `render()`
Re-renderiza a tela ativa. Chamar após qualquer modificação em `D`.

#### `toast(msg, duration=3000)`
Exibe uma notificação no canto inferior direito.

#### `showConfirm(msg, callback, {title, btnLabel})`
Abre modal de confirmação com callback.

#### `fmt(value)`
Formata um número como moeda BRL: `fmt(1234.5)` → `"R$ 1.234,50"`.

#### `inM(tx, m?, y?)`
Retorna `true` se a transação pertence ao mês `m` e ano `y` (padrão: `curM`, `curY`). Respeita `tx.skipped`.

#### `dStr(dateStr)`
Converte `"2025-06-05"` → `"5 Jun 2025"`.

#### `uid()`
Gera um ID único: usa `crypto.randomUUID()` se disponível, com fallback para `Date.now() + random`.

#### `killChart(id)`
Destrói uma instância Chart.js antes de recriar. **Sempre chamar antes de `new Chart(...)`.**

#### `toBRL(amount, currency)`
Converte um valor de moeda estrangeira para BRL usando as taxas em `D.meta.rates`.

### Atalhos de teclado (dashboard)

| Tecla | Ação |
|-------|------|
| `N` | Novo lançamento |
| `R` | Novo recorrente |
| `S` | Forçar sync Drive |
| `/` ou `F` | Abrir busca global |
| `?` | Abrir painel de atalhos |
| `Esc` | Fechar modal/overlay aberto |

---

## 5. App Mobile

### Páginas disponíveis

| ID | Tab | Função que renderiza |
|----|-----|---------------------|
| `pg-home` | Início | `rHome()` |
| `pg-tx` | Lançamentos | `rTx()` |
| `pg-cards` | Contas | `rCards()` |
| `pg-portfolio` | Portfólio | `rPortfolio()` + `renderAnnualMobile()` |
| `pg-settings` | Config. | `rSettings()` |

### Navegação

```js
// Ir para uma página:
goTo('tx', navBtn)

// Renderizar página ativa:
renderPage('home')  // chama rHome(), rTx(), etc.
```

### Estado global do mobile

```js
let D = {}              // objeto de dados
let curM = 5            // mês atual (0-11)
let curY = 2025         // ano atual
let curPg = 'home'      // página ativa
let txFilt = 'all'      // filtro de tipo nos lançamentos
let selTypeV = 'expense' // tipo de lançamento no sheet
let annualYear = 2025   // ano na visão anual
```

### Funções principais do mobile

#### `save()`
Idêntico ao dashboard, mas chama `renderPage(curPg)` ao invés de `render()`.

#### `renderPage(pg)`
Renderiza a página informada. Equivale ao `render()` do dashboard.

#### `toast(msg)`
Notificação no topo da tela.

#### `mConfirm(msg, callback, btnLabel)`
Bottom sheet de confirmação (substitui `confirm()` nativo).

#### `f(value)`
Formata como moeda BRL (versão curta do `fmt` do dashboard).

#### `ds(dateStr)`
Formata data: `"2025-06-05"` → `"05/06"`.

#### `openSheet(type, sub)`
Abre um bottom sheet. Tipos disponíveis: `'tx'`, `'acc'`, `'card'`, `'bud'`, `'goal'`, `'inv'`, `'rec-confirm'`.

#### `closeSheet(id, event)`
Fecha o sheet com ID especificado.

### Atalhos de teclado (mobile)

| Tecla | Ação |
|-------|------|
| `N` | Novo lançamento (despesa) |
| `S` | Forçar sync Drive |
| `Esc` | Fechar sheet aberto |

---

## 6. Sincronização e Drive

### Como funciona o sync

O app tem **três camadas de sincronização**, em ordem de prioridade:

```
1. Mesma aba (estado em memória) → imediato
2. Outras abas do mesmo browser (BroadcastChannel) → milissegundos
3. Google Drive (outro dispositivo) → segundos/minutos
```

### BroadcastChannel (entre abas)

```js
const _bc = new BroadcastChannel('fincontrol');

// Emissor — chamado em save():
_bc.postMessage({ type: 'sync', key: KEY, d: D });

// Receptor — re-renderiza se dados mudaram:
_bc.onmessage = e => {
  if (e.data?.type === 'sync') {
    const merged = mergeDatasets(D, e.data.d);
    D = merged;
    render(); // ou renderPage(curPg) no mobile
  }
};
```

### Google Drive sync

O arquivo `fincontrol-v3.json` é criado na raiz do Drive do usuário.

```js
// Fluxo completo do _driveSync():
1. _driveFindFile()       → acha o ID do arquivo no Drive
2. _driveDownload(fileId) → baixa o JSON remoto
3. _decryptFromDrive(raw) → descriptografa (se E2E ativo)
4. mergeDatasets(D, remote) → merge bidirecional com tombstones
5. save()                 → persiste o resultado local
6. _encryptForDrive(D)   → criptografa para upload
7. _driveUpdate(fileId, payload) → faz upload
```

### `mergeDatasets(local, remote)`

Algoritmo de merge que resolve conflitos por timestamp:

1. Para cada array (`transactions`, `accounts`, `cards`, etc.): une os dois, deduplica por `id`, usa o item com `lastSync` mais recente em caso de conflito
2. Respeita tombstones: se um item foi deletado em um lado (`_deleted: true`), ele some de ambos
3. Retorna o dataset mesclado sem modificar os originais

### `markDeleted(id)`

Adiciona um tombstone para que o delete se propague no próximo sync:

```js
function markDeleted(id) {
  if (!D.meta._deleted) D.meta._deleted = [];
  D.meta._deleted.push({ id: String(id), ts: new Date().toISOString() });
}
```

**Sempre chamar antes de remover um item de um array.**

### Indicador de sync

```
Dashboard: elemento #sdot com classes CSS
  .sdot.sy  → sincronizando (âmbar piscando)
  .sdot.ok  → ok (verde)
  .sdot.er  → erro (vermelho)

Mobile: #sync-dot-m
  .sync-dot.busy → sincronizando
  .sync-dot.ok   → ok
  .sync-dot.err  → erro
```

---

## 7. Criptografia E2E

### Como funciona

A criptografia protege os dados **no Google Drive** — não no localStorage local.

```
Senha do usuário
      ↓
PBKDF2 (200.000 iterações, SHA-256, salt aleatório de 16 bytes)
      ↓
Chave AES-GCM 256-bit (vive só em memória, nunca salva)
      ↓
IV aleatório de 12 bytes a cada upload
      ↓
AES-GCM encrypt(JSON.stringify(D))
      ↓
Arquivo Drive: { fc_encrypted: true, iv: base64, data: base64 }
```

O **salt** é salvo em `localStorage['fc_crypto_salt']` — não é secreto, é necessário para derivar a mesma chave na próxima sessão.

### Ativar/desativar

```js
// Ativar:
setCryptoPassword("minha-senha-forte")

// Desativar:
setCryptoPassword("")
```

### Formato do arquivo Drive com E2E ativo

```json
{
  "fc_encrypted": true,
  "iv": "base64encodedIV12bytes",
  "data": "base64encodedAESGCMciphertext"
}
```

### Sem E2E

O arquivo Drive é simplesmente `JSON.stringify(D)` — legível diretamente.

---

## 8. PWA e Service Worker

### `manifest.json`

Define como o app se comporta ao ser instalado:

```json
{
  "start_url": "./fincontrol-mobile.html",
  "display": "standalone",
  "shortcuts": [
    { "name": "Novo Lançamento", "url": "./fincontrol-mobile.html#new-tx" },
    { "name": "Ver Saldo",       "url": "./fincontrol-mobile.html" },
    { "name": "Dashboard",       "url": "./fincontrol-dashboard.html" }
  ]
}
```

### `service-worker.js`

Estratégias de cache:

| Recurso | Estratégia |
|---------|-----------|
| Arquivos HTML | Network-first (tenta baixar, usa cache se offline) |
| Assets (CSS, JS, imagens) | Cache-first (usa cache, baixa se não tiver) |
| Push notifications | Mostra notificação, abre app no click |

### Atualizar o Service Worker

O SW é versionado pela constante `CACHE = 'fincontrol-v5'`. Para forçar todos os usuários a atualizar o cache, incremente a versão:

```js
const CACHE = 'fincontrol-v6';  // mudou de v5 para v6
```

---

## 9. Como adicionar uma nova tela

### No Dashboard

**Passo 1 — HTML da tela** (adicionar antes de `<!-- SETTINGS -->`)

```html
<div class="sc" id="sc-minhaTela">
  <div class="card">
    <div class="card-hd">
      <div class="card-title">Minha Tela</div>
    </div>
    <div id="minha-tela-conteudo"><!-- preenchido por JS --></div>
  </div>
</div>
```

**Passo 2 — Link na sidebar** (dentro de `<div class="nb-group">`)

```html
<button class="nb" onclick="goTo('minhaTela',this)">
  <span class="ni">★</span>Minha Tela
</button>
```

**Passo 3 — Função de render** (adicionar junto às outras funções)

```js
function renderMinhaTela() {
  document.getElementById('minha-tela-conteudo').innerHTML = `
    <p>Conteúdo aqui</p>
  `;
}
```

**Passo 4 — Registrar no `render()`**

```js
// Dentro do switch em render():
if(s === 'minhaTela') renderMinhaTela();
```

**Passo 5 — Registrar nos metadados**

```js
// Dentro de SC_META:
minhaTela: ['Minha Tela', 'Descrição da tela'],
```

**Passo 6 — Exportar para window** (dentro do `Object.assign(window, {...})`)

```js
renderMinhaTela,
```

---

### No Mobile

**Passo 1 — HTML da página** (antes de `<nav class="nav">`)

```html
<div class="page" id="pg-minha">
  <div class="sec">Minha Página</div>
  <div id="minha-lista"></div>
</div>
```

**Passo 2 — Tab na navbar**

```html
<button class="nav-item" onclick="goTo('minha',this)">
  <span class="nav-icon">★</span>
  <span class="nav-lbl">Minha</span>
</button>
```

**Passo 3 — Função de render**

```js
function rMinha() {
  document.getElementById('minha-lista').innerHTML = 'conteúdo';
}
```

**Passo 4 — Registrar no `renderPage()`**

```js
// Dentro do switch em renderPage():
case 'minha': rMinha(); break;
```

---

## 10. Como adicionar um campo novo em lançamentos

Exemplo: adicionar campo "Estabelecimento" às transações.

### Dashboard

**1. HTML do modal `ov-tx`** (após o campo de categoria, antes do botão salvar)

```html
<div class="fg">
  <label class="fl">Estabelecimento</label>
  <input class="fi" id="tx-place" placeholder="Ex: iFood, Amazon...">
</div>
```

**2. Limpar em `prepTx()`**

```js
document.getElementById('tx-place').value = '';
```

**3. Carregar em `openTxEdit()`**

```js
document.getElementById('tx-place').value = t.place || '';
```

**4. Salvar em `saveTx()`** (ler o campo e incluir no push)

```js
const place = document.getElementById('tx-place').value.trim();
// ...
D.transactions.push({ id: uid(), ..., place });
```

**5. Exibir em `txRow()`** (adicionar na célula da descrição)

```js
${t.place ? `<div style="font-size:9px;color:var(--td)">${t.place}</div>` : ''}
```

### Mobile

Mesmas etapas, mas nos elementos correspondentes:
- Modal: `ov-tx` sheet (entre os campos existentes)
- Limpar: `prepTx()`
- Carregar: `editTx()`
- Salvar: `saveTx()`
- Exibir: função `txCard()` dentro de `rTx()`

---

## 11. Como adicionar uma nova categoria de dado

Exemplo: adicionar "Seguros" como novo módulo.

**1. Schema** — adicionar array em `createDefaultData()`:

```js
seguros: []
```

**2. Também no `createEmptyData()`** para usuários que já têm dados:

```js
if (!D.seguros) D.seguros = [];
```

**3. Funções CRUD** — seguir o padrão de qualquer módulo existente:

```js
function renderSeguros() {
  document.getElementById('seg-list').innerHTML =
    D.seguros.map(s => seguroCard(s)).join('') || '<div class="empty">Nenhum seguro</div>';
}

function saveSeguros() {
  const nome = document.getElementById('seg-nome').value.trim();
  if (!nome) { toast('⚠ Preencha o nome'); return; }
  D.seguros.push({ id: uid(), nome, valor: 0 });
  save(); closeOv('ov-seguros'); render(); toast('✓ Seguro salvo');
}

function delSeguro(id) {
  showConfirm('Excluir este seguro?', () => {
    markDeleted(id);
    D.seguros = D.seguros.filter(s => String(s.id) !== String(id));
    save(); render(); toast('Seguro removido');
  });
}
```

**4. Modal HTML** — seguir o padrão de `ov-account`, `ov-budget`, etc.

**5. Exportar para window** — adicionar no `Object.assign(window, {...})`.

---

## 12. Como alterar o design

### Mudar uma cor global

Edite as CSS custom properties no `<style>`:

```css
/* Mudar a cor de destaque de copper para roxo: */
:root {
  --cu:   #7c3aed;
  --cu-s: rgba(124,58,237,.12);
  --cu-b: rgba(124,58,237,.35);
}
```

### Mudar o border-radius geral

```css
:root {
  --r:    8px;   /* era 11px */
  --r-sm: 5px;   /* era 7px */
  --r-lg: 12px;  /* era 16px */
}
```

### Adicionar um novo tema

No dashboard, os temas são definidos com `[data-theme="nome"]`:

```css
[data-theme="roxo"] {
  --cu:   #7c3aed;
  --cu-s: rgba(124,58,237,.12);
  --cu-b: rgba(124,58,237,.35);
}
```

E registrar na função `setTheme()`:

```js
// O tema é aplicado assim:
document.documentElement.setAttribute('data-theme', 'roxo');
localStorage.setItem('fc_theme', 'roxo');
```

Adicionar o botão de seleção no painel de personalização (`.cust-item[data-t="roxo"]`).

### Mudar o tamanho da fonte

O zoom de fonte é controlado via `document.documentElement.style.zoom`:

```js
function setFontSize(size) {  // size: "0.9", "1.0", "1.1"
  document.documentElement.style.zoom = size;
  localStorage.setItem('fc_font_size', size);
}
```

---

## 13. Como gerar um novo relatório PDF

O sistema de relatórios abre uma nova janela com HTML imprimível e chama `window.print()` automaticamente.

### Estrutura básica

```js
function exportMeuRelatorio() {
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
    <meta charset="UTF-8">
    <title>Meu Relatório</title>
    <style>
      /* Estilos de impressão */
      body { font-family: -apple-system, sans-serif; font-size: 12px; color: #1a1a1a; }
      @media print { body { -webkit-print-color-adjust: exact; } }
    </style>
  </head><body>
    <h1>Relatório — ${new Date().toLocaleDateString('pt-BR')}</h1>
    <table>
      <thead><tr><th>Descrição</th><th>Valor</th><th>Data</th></tr></thead>
      <tbody>
        ${D.transactions.filter(t => inM(t)).map(t => `
          <tr>
            <td>${t.desc}</td>
            <td>${fmt(t.amount)}</td>
            <td>${dStr(t.date)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  <\\/body></html>`);
  // IMPORTANTE: a barra antes de /script é necessária para não fechar o template literal
  w.document.write(`<script>window.print()<\\/script>`);
  w.document.close();
}
```

### Padrão dos relatórios existentes

Todos os relatórios seguem o mesmo CSS base definido em `exportReport()` no dashboard. Para consistência visual, copie o bloco `<style>` daquela função como ponto de partida.

---

## 14. Referência completa de funções

### Funções compartilhadas (Dashboard e Mobile)

| Função | Parâmetros | Descrição |
|--------|-----------|-----------|
| `uid()` | — | Gera ID único via `crypto.randomUUID()` |
| `inM(tx, m?, y?)` | tx, mês, ano | `true` se tx pertence ao período |
| `toBRL(amount, currency)` | valor, moeda | Converte para BRL usando taxas em cache |
| `fetchRates()` | — | Busca taxas de câmbio (cache 1h) |
| `markDeleted(id)` | id | Registra tombstone de deleção |
| `mergeDatasets(a, b)` | dois datasets | Merge bidirecional com tombstones |
| `save()` | — | Persiste D no localStorage + agenda Drive sync |
| `toast(msg, dur?)` | mensagem, ms | Notificação temporária |
| `loginWithGoogle()` | — | Inicia fluxo OAuth Google |
| `logout()` | — | Revoga token e recarrega |
| `_driveSync()` | — | Executa ciclo completo de sync com Drive |
| `setCryptoPassword(pwd)` | senha | Ativa/desativa criptografia E2E |

### Funções exclusivas do Dashboard

| Função | Descrição |
|--------|-----------|
| `render()` | Re-renderiza a tela ativa |
| `renderDash()` | Renderiza tela inicial (KPIs, gráficos) |
| `renderTx()` | Renderiza tabela de lançamentos |
| `renderAccounts()` | Renderiza cards de contas |
| `renderBudgets()` | Renderiza barras de orçamento |
| `renderGoals()` | Renderiza cards de metas |
| `renderCards()` | Renderiza faturas dos cartões |
| `renderInvestments()` | Renderiza portfólio |
| `renderAnnual()` | Renderiza visão anual com gráficos |
| `renderSettings()` | Renderiza configurações |
| `showConfirm(msg, cb, opts)` | Modal de confirmação com callback |
| `openMod(type, sub?)` | Abre modal (ov-tx, ov-account, etc.) |
| `openOv(id)` / `closeOv(id)` | Abre/fecha overlay por ID |
| `openTxEdit(id)` | Abre modal de edição de lançamento |
| `fmt(value)` | Formata como BRL (R$ 1.234,56) |
| `dStr(dateStr)` | Formata data (5 Jun 2025) |
| `killChart(id)` | Destrói instância Chart.js |
| `txRow(tx, showDel?)` | HTML de uma linha da tabela de transações |
| `exportReport(period?)` | Gera relatório mensal/trimestral em PDF |
| `exportAnnualReport()` | Gera relatório anual em PDF |
| `exportJSON()` / `importJSON()` | Backup/restore completo |
| `exportCSV()` | Exporta lançamentos para CSV |
| `runSearch()` | Executa busca global |
| `goTo(sc, btn)` | Navega para uma tela |
| `chMonth(delta)` | Avança/recua o mês |

### Funções exclusivas do Mobile

| Função | Descrição |
|--------|-----------|
| `renderPage(pg)` | Re-renderiza a página informada |
| `rHome()` | Renderiza página Início |
| `rTx()` | Renderiza lista de lançamentos |
| `rCards()` | Renderiza contas e cartões |
| `rPortfolio()` | Renderiza portfólio (metas + investimentos) |
| `rSettings()` | Renderiza configurações |
| `renderAnnualMobile()` | Renderiza visão anual no portfólio |
| `exportAnnualReportMobile()` | Gera relatório anual PDF |
| `openSheet(type, sub?)` | Abre bottom sheet |
| `closeSheet(id, evt?)` | Fecha bottom sheet |
| `editTx(id)` | Abre sheet de edição de lançamento |
| `mConfirm(msg, cb, btn?)` | Bottom sheet de confirmação |
| `txCard(tx)` | HTML de um card de transação |
| `f(value)` | Formata como BRL (versão curta) |
| `ds(dateStr)` | Formata data (05/06) |
| `goTo(pg, btn)` | Navega para uma página |
| `cm(delta)` | Avança/recua o mês |

---

## 15. Fluxos críticos passo a passo

### Fluxo: criar um lançamento (dashboard)

```
1. Usuário clica "+ Lançamento" na sidebar ou pressiona N
2. openMod('tx') → prepTx('expense') → updateTxUI()
3. openOv('ov-tx') → overlay aparece
4. Usuário preenche campos e clica "Salvar"
5. saveTx():
   a. Lê valores dos inputs
   b. Valida (desc, amount, date obrigatórios)
   c. Push em D.transactions com uid() e os campos
   d. Se accountId: atualiza account.balance
   e. Se "salvar como recorrente": push em D.recurring
   f. save() → localStorage + BroadcastChannel + agenda Drive
   g. closeOv('ov-tx') + render() + toast()
```

### Fluxo: excluir um lançamento

```
1. Usuário clica ✕ na linha da tabela → delTx(id)
2. showConfirm("Excluir?", callback)
3. callback():
   a. Se type !== 'card' && accountId: reverte account.balance
   b. markDeleted(id) → adiciona tombstone
   c. D.transactions = D.transactions.filter(t => t.id !== id)
   d. save() + render() + toast()
```

### Fluxo: sync com Drive

```
1. Usuário salva qualquer dado → save() agenda _driveSync() após 1,5s
   (ou usuário clica "Sync" → doSync() → _driveSync() imediato)
2. _driveSync():
   a. _setSyncDot('busy', 'Sincronizando...')
   b. _driveFindFile() → busca 'fincontrol-v3.json' no Drive
   c. _driveDownload(fileId) → baixa JSON do Drive
   d. _decryptFromDrive(raw) → descriptografa se E2E ativo
   e. mergeDatasets(D, remote) → merge bidirecional
   f. save() → persiste resultado local
   g. _encryptForDrive(D) → criptografa para upload
   h. _driveUpdate(fileId, payload) → sobe para Drive
   i. _setSyncDot('ok', 'Drive ☁ 14:32')
```

### Fluxo: importar extrato OFX/CSV

```
1. Usuário acessa Importar Extrato → clica "Escolher arquivo"
2. handleImportFile() → processImportFile()
3. processImportFile():
   a. Detecta .ofx → parseOFX() ou .csv → parseCSV()
   b. Normaliza para array de { date, desc, amount, type }
   c. Filtra dupes com _isDupeImport() (compara date+amount+desc)
   d. renderImportPreview() → mostra lista com checkboxes
4. Usuário desmarca linhas indesejadas, escolhe conta destino
5. confirmImport():
   a. Filtra só os checked (ignora dupes)
   b. Push em D.transactions para cada linha
   c. save() + render() + toast("X lançamentos importados")
```

---

## 16. Checklist antes de publicar uma mudança

Antes de fazer `git push`, verifique:

**Funcional**
- [ ] O fluxo principal da feature funciona no browser
- [ ] Criar, editar e excluir o dado afetado funciona
- [ ] O dado persiste após recarregar a página (F5)
- [ ] A mudança funciona nos dois arquivos (se relevante para ambos)

**Técnico**
- [ ] Nenhum `confirm()` nativo (usar `showConfirm` ou `mConfirm`)
- [ ] Novos IDs usam `uid()` — nunca `Date.now()` diretamente
- [ ] Deleções chamam `markDeleted(id)` antes de filtrar o array
- [ ] Chart.js: `killChart(id)` é chamado antes de `new Chart(...)`
- [ ] Funções novas do dashboard estão no `Object.assign(window, {...})`
- [ ] Template literals balanceados (rode: `node -e "const s=require('fs').readFileSync('fincontrol-dashboard.html','utf8'); console.log((s.match(/\`/g)||[]).length % 2 === 0 ? 'OK' : 'ERRO')"`)

**Sync**
- [ ] Novos campos são incluídos no schema de `createDefaultData()` e `createEmptyData()`
- [ ] `mergeDatasets()` consegue lidar com o novo campo (arrays precisam ter `id`)

**Commit**
```bash
git add fincontrol-dashboard.html fincontrol-mobile.html
git commit -m "feat: descrição do que foi feito"
git push
```

---

*Manual Avançado — FinControl v3 · Junho 2025*
