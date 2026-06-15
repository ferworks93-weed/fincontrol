# FinControl — Handoff para Claude Code

> **Dono do projeto:** Fernando de Araújo Meira  
> **Data do handoff:** Junho 2025  
> **Versão atual:** v3 (dois arquivos HTML standalone)  
> **Status:** Funcional para uso diário — pronto para refatoração e extensão no Claude Code

---

## Índice

1. [O que é o FinControl](#1-o-que-é-o-fincontrol)
2. [Arquivos atuais](#2-arquivos-atuais)
3. [Arquitetura atual](#3-arquitetura-atual)
4. [Schema de dados (localStorage)](#4-schema-de-dados-localstorage)
5. [Design System](#5-design-system)
6. [O que está funcionando](#6-o-que-está-funcionando)
7. [Bugs confirmados e inconsistências](#7-bugs-confirmados-e-inconsistências)
8. [Melhorias planejadas](#8-melhorias-planejadas)
9. [Próximos passos — ordenados por prioridade](#9-próximos-passos--ordenados-por-prioridade)
10. [Como continuar no Claude Code](#10-como-continuar-no-claude-code)
11. [Contexto financeiro do usuário](#11-contexto-financeiro-do-usuário)

---

## 1. O que é o FinControl

Sistema de controle financeiro pessoal composto por **dois aplicativos HTML standalone** que rodam diretamente no browser, sem servidor, sem dependências de backend.

| Arquivo | Plataforma | Tamanho |
|---------|-----------|---------|
| `fincontrol-dashboard.html` | Desktop (Chrome/Edge) | ~130 KB |
| `fincontrol-mobile.html` | Mobile (Chrome Android / Safari iOS) | ~67 KB |

**Princípio central:** dados salvos no `localStorage` do browser. Sync entre as duas versões via `window.storage` event quando abertas no mesmo browser, ou via exportação/importação de JSON.

---

## 2. Arquivos atuais

```
fincontrol-dashboard.html   — Painel Web completo (1971 linhas)
fincontrol-mobile.html      — App Mobile PWA (1027 linhas)
fincontrol-manual.docx      — Manual do usuário (Word)
```

Estes três arquivos são a entrega atual. Para continuar, baixe-os e coloque numa pasta de projeto.

---

## 3. Arquitetura atual

### 3.1 Padrão geral

Ambos os arquivos seguem o mesmo padrão:

```
HTML estrutural
└── <style>  → CSS completo inline (design tokens via CSS vars)
└── <script> → JavaScript completo inline
    ├── Constantes e schema de dados
    ├── Estado global (curM, curY, curSc, etc.)
    ├── Funções de dados (mkDefault / defaultData, save, adaptadores)
    ├── Helpers (fmt, inM, ds, gc, ga, killChart)
    ├── Renderizadores por tela (renderDash, renderTx, ...)
    ├── Handlers de formulários (saveTx, saveAccount, ...)
    ├── Funções de modal/sheet (openMod, closeOv, openSheet, ...)
    └── Init + event listeners
```

### 3.2 Dashboard Web — telas

| ID da tela | Nome | Funcionalidade |
|-----------|------|---------------|
| `sc-dashboard` | Dashboard | KPIs, gráficos, preview de orçamentos/metas, últimos lançamentos |
| `sc-transactions` | Lançamentos | Tabela filtrável por tipo, busca por texto |
| `sc-recurring` | Recorrentes | Configuração e confirmação mensal (fixos e variáveis) |
| `sc-import` | Importar Extrato | OFX/CSV com preview e seleção por linha |
| `sc-accounts` | Contas | Cards por conta, gráfico de alocação |
| `sc-budgets` | Orçamentos | Barras de progresso por categoria |
| `sc-goals` | Metas | Cards com prazo e cálculo mensal |
| `sc-cards` | Cartões | Fatura por ciclo, parcelamentos |
| `sc-investments` | Investimentos | Portfólio, operações, proventos |
| `sc-annual` | Visão Anual | Grade 12 meses + gráfico de linha |
| `sc-settings` | Configurações | Categorias, backup, personalização |

### 3.3 App Mobile — páginas

| ID da página | Tab | Funcionalidade |
|-------------|-----|---------------|
| `pg-home` | Início | Saldo, ações rápidas, gráfico, orçamentos, recentes |
| `pg-tx` | Lançamentos | Lista filtrável por tipo com seletor de mês |
| `pg-cards` | Contas | Contas bancárias + cartões de crédito + parcelamentos |
| `pg-portfolio` | Portfólio | Metas + investimentos com operações |
| `pg-settings` | Config. ⚙ | Sync, personalização, categorias, backup |

### 3.4 Dependências externas

| Lib | Versão | Onde | Crítico offline? |
|-----|--------|------|-----------------|
| Chart.js | 4.4.0 | Dashboard apenas | **Sim** — gráficos quebram sem internet |
| Google Fonts (Inter) | — | Dashboard apenas | Não — tem fallback system-ui |
| Nenhuma | — | Mobile | Mobile é 100% offline |

### 3.5 Fluxo de dados

```
Usuário digita → save() → localStorage['fincontrol_v3']
                              ↓
               window.storage event → outra aba atualiza D → render()

Backup manual: exportar JSON → transferir → importar JSON
```

### 3.6 Adaptador de compatibilidade

O dashboard usa campos levemente diferentes do mobile. Existe um adaptador em cada arquivo:

- **Dashboard:** `migrateData(d)` — converte `recurrents` → `recurring`, normaliza `operations[].type` → `.kind`
- **Mobile:** `mobileAdapt(d)` — faz o inverso: `recurring` → `recurrents`, `.kind` → `.type`
- **Dashboard `save()`:** também sincroniza `D.recurrents` a partir de `D.recurring` antes de salvar

---

## 4. Schema de dados (localStorage)

**Chave:** `fincontrol_v3`

```jsonc
{
  "meta": {
    "version": 3,          // ATENÇÃO: dashboard ainda gera version:4 no mkDefault
    "lastSync": null,      // ISO string da última sincronização
    "driveFileId": null,   // ID do arquivo no Google Drive (não implementado)
    "dashConfig": {        // Personalização do dashboard web
      "kpis": true,
      "charts": true,
      "widgets": true,
      "table": true,
      "alerts": true
    },
    "homeConfig": {        // Personalização do home mobile
      "balance": true,
      "minirow": true,
      "quickact": true,
      "flowchart": true,
      "budgets": true,
      "recent": true
    }
  },
  "categories": {
    "income": ["Salário", "Comissão", "Benefício refeição", "Outros rendimentos"],
    "expense": ["Alimentação", "Transporte", "Moradia", "Saúde", "Lazer", "Assinaturas", "Vestuário", "Educação", "Outros"],
    "card": ["Alimentação", "Transporte", "Saúde", "Lazer", "Assinaturas", "Vestuário", "Educação", "Outros"]
  },
  "accounts": [
    { "id": 1, "name": "Conta Corrente", "bank": "Nubank", "balance": 3200, "type": "checking", "color": "#8472d8" }
  ],
  "cards": [
    { "id": 1, "name": "Nubank", "limit": 8000, "closing": 1, "due": 8, "color": "#820ad1" }
  ],
  "budgets": [
    { "id": 1, "category": "Alimentação", "limit": 600 }
  ],
  "goals": [
    { "id": 1, "name": "Reserva de emergência", "target": 30000, "current": 11700, "deadline": "2025-12-31", "icon": "🛡" }
  ],
  "recurrents": [
    // Campo canônico do mobile
    { "id": 1, "desc": "Salário", "type": "income", "cat": "Salário", "amount": 8500,
      "day": 5, "variable": false, "active": true, "cardId": null, "accountId": 1 }
  ],
  "recurring": [
    // Campo canônico do dashboard (adaptado de recurrents)
    { "id": 1, "desc": "Salário", "type": "income", "cat": "Salário", "amount": 8500,
      "day": 5, "variable": false }
  ],
  "transactions": [
    { "id": 1718000000001, "type": "income",  "desc": "Salário", "amount": 8500,
      "date": "2025-06-05", "cat": "Salário", "cardId": null, "accountId": 1,
      "installments": 1, "recurrentId": 1, "note": "", "skipped": false }
  ],
  "investments": [
    { "id": 1, "name": "CDB Banco Inter", "type": "Renda Fixa", "amount": 15000,
      "returnPct": 12.5,
      "dividends": [{ "date": "2025-04-15", "amount": 120, "note": "" }],
      "operations": [{ "id": 1, "date": "2024-01-10", "type": "aporte", "amount": 15000, "note": "Abertura" }]
      // ATENÇÃO: dashboard usa "kind" em vez de "type" nas operations — BUG #3
      // "cost": 15000  // campo apenas no dashboard — BUG #2
    }
  ]
}
```

### Tipos de transação

| type | Descrição |
|------|-----------|
| `income` | Receita — crédito na conta |
| `expense` | Despesa — débito na conta |
| `card` | Gasto no cartão de crédito |
| `transfer` | Transferência entre contas (apenas web) |

---

## 5. Design System

### 5.1 Paleta de cores (CSS Custom Properties)

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
--tm:  #6b6b6b   /* texto secundário/mutado */
--td:  #3d3d3d   /* texto muito apagado */

/* Cores semânticas */
--cu: #b87333    /* copper — marca/acento/CTAs */
--gn: #34c77b    /* green — receitas, positivo */
--rd: #d95f5f    /* red — despesas, negativo, perigo */
--bl: #4f8ef7    /* blue — cartão, metas */
--vt: #8b7cf8    /* violet — investimentos, patrimônio */
--am: #e8a838    /* amber — aviso, variável */
```

### 5.2 Tipografia

```css
--font: 'Inter', -apple-system, 'Segoe UI', sans-serif
--mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace
font-variant-numeric: tabular-nums  /* em todos os valores financeiros */
```

### 5.3 Espaçamento e bordas

```css
--r:    11px   /* border-radius padrão */
--r-sm: 7px    /* border-radius pequeno */
--r-lg: 16px   /* border-radius grande (modais) */
--sb:   220px  /* largura da sidebar */
--top:  52px   /* altura da topbar */
```

### 5.4 Princípios de design

- **Dark-first:** toda a UI é dark por padrão, sem modo claro implementado
- **Sem sombras:** profundidade por diferença de tom entre `--s1`, `--s2`, `--s3`
- **Bordas 1px:** separadores visuais usam `1px solid var(--bd)`
- **Números tabulares:** `font-variant-numeric: tabular-nums` em todo valor financeiro
- **Mobile:** bottom sheets (slide de baixo para cima), FAB copper, bottom nav 5 itens
- **Web:** sidebar fixa 220px, topbar sticky, conteúdo scrollável

---

## 6. O que está funcionando

### Dashboard Web ✅

- 5 KPIs: Receitas, Despesas, Saldo, Saldo em Contas, Patrimônio
- Gráfico de barras (6 meses) e donut (distribuição de despesas) — Chart.js
- Alertas automáticos de orçamento (warn 80%, danger 100%)
- Lançamentos: tabela com filtro por tipo, busca por texto, edição, exclusão
- Recorrentes: configuração, confirmação mensal, fixos e variáveis, pular mês
- Contas: CRUD, edição de saldo inline, gráfico de alocação
- Cartões: fatura calculada por ciclo de fechamento, parcelamentos
- Orçamentos: CRUD, barras de progresso com 3 estados de cor
- Metas: progresso, prazo, cálculo de parcela mensal, edição
- Investimentos: CRUD, aporte/resgate/dividendo, lucro calculado, histórico imprimível
- Visão Anual: grade 12 meses clicável, gráfico de linha evolução
- Importação OFX e CSV com preview, seleção por linha, conta destino
- Exportação CSV (Excel PT-BR) e relatório HTML imprimível
- Configurações: categorias CRUD, backup JSON, personalização de 5 seções do dashboard
- Atalhos: `N` novo lançamento, `Esc` fechar modal
- Sync automático via `window.storage` event
- Adaptador `migrateData()` para ler dados criados pelo mobile

### App Mobile ✅

- 5 tabs: Início, Lançamentos, Contas, Portfólio, Config.
- Tela Início: saldo, mini-cards, ações rápidas, gráfico de barras (vanilla JS), orçamentos, recentes
- Personalização do Início: toggle por seção (6 seções configuráveis)
- Lançamentos: lista filtrável com seletor de mês
- Contas: saldo por conta + cartões com fatura + parcelamentos
- Portfólio: metas + investimentos com operações
- Config: sync, personalização, categorias, backup JSON
- FAB copper em todas as telas para novo lançamento
- Bottom sheets para todos os formulários
- Adaptador `mobileAdapt()` para ler dados criados pelo dashboard
- 100% offline (sem dependências CDN)

---

## 7. Bugs confirmados e inconsistências

### 🔴 Críticos (causam dados errados ou quebra)

**BUG-01 — meta.version divergente**
- Dashboard gera `version: 4` no `mkDefault()`, mobile gera `version: 3`
- Impacto: se houver lógica de migração futura baseada em versão, vai falhar
- Arquivo: `fincontrol-dashboard.html` linha ~870 — `mkDefault()`
- Fix: padronizar para `version: 3` em ambos

**BUG-02 — Campo `cost` apenas no dashboard**
- Dashboard usa `i.cost` para calcular lucro dos investimentos
- Mobile calcula lucro somando `operations` (sem campo `cost`)
- Impacto: lucro exibido pode ser diferente nas duas versões
- Fix: remover campo `cost` do dashboard, usar mesmo cálculo do mobile: `sum(aportes) - sum(resgates)`

**BUG-03 — operations[].kind vs operations[].type**
- Dashboard: `op.kind = 'aporte'|'resgate'|'dividendo'`
- Mobile: `op.type = 'aporte'|'resgate'|'dividendo'`
- Adaptador parcial existe mas é frágil — seed do dashboard ainda grava `kind`
- Fix: padronizar para `type` em ambos; remover `kind` completamente

**BUG-04 — inM() não filtra `skipped` uniformemente**
- `inM()` nos dois arquivos não considera `t.skipped`
- Transações com `skipped: true` aparecem em alguns contextos (ex: contagem de lançamentos)
- Fix: `const inM = (t, m, y) => !t.skipped && ...` como padrão, ou remover `skipped` e apenas não criar a transação ao pular

### 🟡 Médios (comportamento inesperado, não quebra)

**BUG-05 — Funções de seed divergentes**
- `mkDefault()` no dashboard vs `defaultData()` no mobile
- Contas de seed diferentes: dashboard tem "Nubank Conta" e "Bradesco", mobile tem contas reais
- Fix: criar `sharedDefaultData()` num arquivo comum, ou documentar os dados reais de Fernando para ambos

**BUG-06 — Namespace de config de personalização**
- `D.meta.dashConfig` (dashboard) vs `D.meta.homeConfig` (mobile)
- Ambos existem no mesmo objeto, mas não comunicam entre si
- Fix: unificar em `D.meta.uiConfig = { dash: {...}, home: {...} }`

**BUG-07 — exportCSV() chama exportReport()**
- `function exportCSV()` chama `exportReport('csv')` internamente
- `exportReport` pode não estar definida como função nomeada em todas as versões
- Fix: verificar e consolidar as funções de exportação

**BUG-08 — IDs sem sufixo aleatório**
- `id: Date.now()` sem `+ Math.random()` em vários saves
- Em saves rápidos seguidos, IDs podem colidir
- Fix: usar `id: Date.now() + Math.floor(Math.random() * 10000)` consistentemente, ou usar `crypto.randomUUID()`

**BUG-09 — killChart() pode causar memory leak**
- Nem todas as telas chamam `killChart()` antes de recriar um chart
- Uso prolongado pode acumular instâncias Chart.js em memória
- Fix: centralizar destruição de chart em `render()` antes de chamar o renderizador de tela

### 🟢 Baixos (UX ou compatibilidade)

**BUG-10 — Google Fonts via CDN no dashboard**
- `@import url('https://fonts.googleapis.com/...')` quebra quando offline
- Fix: remover e usar apenas `font-family: -apple-system, 'Segoe UI', system-ui, sans-serif`

**BUG-11 — localStorage sem try/catch**
- `localStorage.setItem()` pode lançar `QuotaExceededError` silenciosamente
- Fix: envolver `save()` em try/catch com toast de erro

**BUG-12 — Mobile sem busca em Lançamentos**
- Dashboard tem campo de busca por texto, mobile não tem
- Usuário com muitos lançamentos fica sem filtro de texto no mobile

**BUG-13 — Dashboard sem responsividade tablet**
- Sidebar fixa de 220px + layout grid não quebram para telas < 1024px
- Fix: media queries para colapsar sidebar em drawer ou ocultar em < 768px

**BUG-14 — doSync() não conecta ao Drive**
- Simula sync com `setTimeout`; `D.meta.driveFileId` nunca é preenchido
- Botão dá feedback visual de sucesso mas não faz nada

---

## 8. Melhorias planejadas

### Fase A — Consolidação (eliminar dívida técnica)

| # | Melhoria | Impacto | Esforço |
|---|----------|---------|---------|
| A1 | Schema único: `sharedSchema.js` com `createDefaultData()`, tipos TypeScript | Alto | Médio |
| A2 | ID gerador único: `crypto.randomUUID()` substituindo `Date.now()` | Médio | Baixo |
| A3 | Remover `cost` de investments; usar cálculo por operações em ambos | Alto | Baixo |
| A4 | Padronizar `operations[].type` (remover `kind`) | Alto | Baixo |
| A5 | `meta.version = 3` consistente; função de migração por versão | Alto | Médio |
| A6 | `save()` com try/catch e toast de erro | Médio | Baixo |
| A7 | `inM()` com flag `includeSkipped` opcional | Médio | Baixo |
| A8 | Remover Google Fonts CDN do dashboard | Baixo | Baixo |

### Fase B — UX Mobile

| # | Melhoria | Impacto | Esforço |
|---|----------|---------|---------|
| B1 | Campo de busca na aba Lançamentos | Alto | Baixo |
| B2 | Edição de lançamento (modal/sheet de edição) | Alto | Médio |
| B3 | Pull-to-refresh para sync entre tabs | Médio | Baixo |
| B4 | Confirmação antes de excluir (replace por sheet ao invés de confirm()) | Médio | Baixo |
| B5 | Swipe left para excluir lançamento (gesture) | Médio | Alto |

### Fase C — Features novas

| # | Feature | Impacto | Esforço |
|---|---------|---------|---------|
| C1 | Google Drive sync real (OAuth + Drive API v3) | Alto | Alto |
| C2 | PWA completo com Service Worker (offline + install) | Alto | Alto |
| C3 | Notificações push de orçamento | Médio | Alto |
| C4 | Previsão de fechamento de mês | Alto | Médio |
| C5 | Gráfico de evolução de patrimônio | Médio | Médio |
| C6 | Tema claro / escuro com toggle | Médio | Médio |
| C7 | Drag-and-drop para reordenar seções | Baixo | Alto |
| C8 | Exportar por QR Code | Baixo | Alto |

### Fase D — Arquitetura

| # | Melhoria | Impacto | Esforço |
|---|----------|---------|---------|
| D1 | Separar em múltiplos arquivos (JS modules) | Alto | Alto |
| D2 | Adicionar TypeScript com tipos para todos os models | Alto | Alto |
| D3 | Testes unitários para funções de dados e helpers | Alto | Alto |
| D4 | Build com Vite ou Parcel para bundle final otimizado | Médio | Médio |

---

## 9. Próximos passos — ordenados por prioridade

### 🔴 ETAPA 1 — Correção de bugs críticos (começar aqui)
**Objetivo:** estabilizar o schema de dados antes de qualquer nova feature

```
Passo 1.1 — Padronizar meta.version
  Arquivo: fincontrol-dashboard.html
  Local: função mkDefault(), linha ~870
  Ação: mudar version:4 → version:3

Passo 1.2 — Remover campo cost dos investments
  Arquivo: fincontrol-dashboard.html
  Local: funções renderInvestments() e saveInvest()
  Ação: substituir i.cost por cálculo via operations
    const custo = (i.operations||[])
      .filter(o=>(o.type||o.kind)==='aporte').reduce((a,o)=>a+o.amount,0)
    - (i.operations||[])
      .filter(o=>(o.type||o.kind)==='resgate').reduce((a,o)=>a+o.amount,0);
  Depois: remover campo cost do mkDefault()

Passo 1.3 — Padronizar operations[].type (remover kind)
  Arquivo: fincontrol-dashboard.html
  Local: mkDefault() seed, saveInvestOp(), renderInvestments()
  Ação: substituir todas as ocorrências de .kind por .type
    grep "\.kind" fincontrol-dashboard.html → encontrar e substituir

Passo 1.4 — Corrigir inM() para respeitar skipped
  Arquivo: ambos os arquivos
  Local: linha da const inM = ...
  Ação: adicionar verificação de skipped
    const inM = (t, m, y) => {
      if (t.skipped) return false;
      const d = new Date(t.date + 'T12:00:00');
      return d.getMonth() === (m ?? curM) && d.getFullYear() === (y ?? curY);
    };

Passo 1.5 — IDs com crypto.randomUUID()
  Arquivo: ambos os arquivos
  Local: todas as funções save* (saveTx, saveAccount, etc.)
  Ação: substituir id: Date.now() por
    id: typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now() + Math.floor(Math.random() * 100000)
```

### 🟡 ETAPA 2 — Unificação do schema de dados
**Objetivo:** um único arquivo de dados usado por ambas as versões

```
Passo 2.1 — Criar shared-data.js
  Conteúdo:
    - Constante SCHEMA_VERSION = 3
    - Função createDefaultData() com dados reais de Fernando
    - Tipos comentados (JSDoc) para cada entidade
    - Função migrateData(raw) com suporte a versões 1, 2, 3
    - Função generateId() usando crypto.randomUUID com fallback
    - Constante STORAGE_KEY = 'fincontrol_v3'

Passo 2.2 — Dados reais de Fernando no seed
  Contas reais:
    { id:1, name:'Conta Corrente', bank:'Nubank', type:'checking', color:'#820ad1' }
    { id:2, name:'Poupança', bank:'Inter', type:'savings', color:'#f97316' }
    { id:3, name:'Carteira', bank:'Dinheiro', type:'cash', color:'#34c77b' }
  Recorrentes reais:
    Salário (R$8.500, dia 5), Comissão (variável, dia 5),
    Benefício refeição (R$600, dia 5), Aluguel (R$1.800, dia 10)
  Investimentos reais:
    CDB Inter, Tesouro Selic, IVVB11, FII XPML11
  Cartões reais:
    Nubank (limite 8k, fecha dia 1, vence dia 8)
    Inter (limite 5k, fecha dia 15, vence dia 22)

Passo 2.3 — Substituir mkDefault() e defaultData()
  Ambos os arquivos passam a usar createDefaultData() do shared-data.js
  (ou copiar o conteúdo idêntico inline em cada HTML enquanto são arquivos únicos)

Passo 2.4 — Remover adaptadores migrateData/mobileAdapt
  Após schema unificado, os adaptadores deixam de ser necessários
  migrateData() final deve apenas lidar com versões antigas (v1, v2)
```

### 🟡 ETAPA 3 — Melhorias de UX Mobile
**Objetivo:** paridade de funcionalidade com o dashboard

```
Passo 3.1 — Campo de busca em Lançamentos
  Arquivo: fincontrol-mobile.html
  Local: pg-tx (antes do chips de filtro)
  Código a adicionar:
    <input class="fi" id="m-tx-search" placeholder="Buscar..."
           oninput="rTx()" style="margin-bottom:8px;width:100%">
  Em rTx():
    const q = (document.getElementById('m-tx-search')?.value||'').toLowerCase();
    if(q) list = list.filter(t => t.desc.toLowerCase().includes(q) || t.cat.toLowerCase().includes(q));

Passo 3.2 — Edição de lançamento no mobile
  Arquivo: fincontrol-mobile.html
  Ação: adicionar sheet de edição (reusar o sheet de tx existente)
  Em cada txCard(), mudar onclick de excluir para abrir sheet de edição:
    onclick="editMobileTx(${t.id})"
  Nova função:
    function editMobileTx(id) {
      const t = D.transactions.find(x => x.id === id);
      if (!t) return;
      document.getElementById('ov-tx').dataset.editId = id;
      prepTx(t.type);
      // preencher campos com valores de t
      openSheet('tx', t.type);
    }
  Em saveTx() mobile: verificar se dataset.editId existe e editar ao invés de criar

Passo 3.3 — Confirmar antes de excluir
  Arquivo: fincontrol-mobile.html
  Substituir confirm() nativo por bottom sheet de confirmação
  Criar ov-confirm sheet com título/mensagem dinâmicos e callbacks

Passo 3.4 — Pull-to-refresh
  Arquivo: fincontrol-mobile.html
  Adicionar listener de touchstart/touchend no .pages
  Quando scroll = 0 e arrasta para baixo > 60px: chamar doSync() + renderPage()
```

### 🟢 ETAPA 4 — Service Worker e PWA
**Objetivo:** instalação como app nativo e funcionamento 100% offline

```
Passo 4.1 — Criar manifest.json
  {
    "name": "FinControl",
    "short_name": "FinControl",
    "start_url": "./fincontrol-mobile.html",
    "display": "standalone",
    "background_color": "#0a0a0a",
    "theme_color": "#b87333",
    "icons": [
      { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
      { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
    ]
  }

Passo 4.2 — Criar service-worker.js
  const CACHE = 'fincontrol-v3';
  const FILES = ['./fincontrol-mobile.html', './manifest.json', './icon-192.png'];
  
  self.addEventListener('install', e => e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(FILES))
  ));
  self.addEventListener('fetch', e => e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  ));

Passo 4.3 — Registrar SW no mobile
  No init do fincontrol-mobile.html:
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js');
    }

Passo 4.4 — Adicionar meta tags PWA no mobile
  <link rel="manifest" href="manifest.json">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="FinControl">
```

### 🟢 ETAPA 5 — Google Drive Sync real
**Objetivo:** backup automático e sync entre dispositivos via Drive

```
Passo 5.1 — Criar projeto no Google Cloud Console
  1. Acessar console.cloud.google.com
  2. Criar projeto "FinControl"
  3. Ativar Google Drive API
  4. Criar credenciais OAuth 2.0 (Web Application)
  5. Adicionar origem autorizada: file:// e qualquer servidor de desenvolvimento
  6. Copiar Client ID

Passo 5.2 — Adicionar Google Identity Services
  <script src="https://accounts.google.com/gsi/client"></script>

Passo 5.3 — Implementar fluxo OAuth
  function initGoogleAuth() {
    google.accounts.oauth2.initTokenClient({
      client_id: 'SEU_CLIENT_ID',
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (resp) => { gAccessToken = resp.access_token; }
    }).requestAccessToken();
  }

Passo 5.4 — Funções de sync com Drive
  async function driveUpload(data) {
    const content = JSON.stringify(data);
    const fileId = D.meta.driveFileId;
    const url = fileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    // POST/PATCH com Bearer token
  }
  async function driveDownload() {
    // GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media
  }
```

---

## 10. Como continuar no Claude Code (App Nativo Desktop)

### 10.1 O que é o Claude Code Desktop

O **Claude Code Desktop** é o aplicativo nativo da Anthropic para macOS e Windows. É diferente do terminal CLI — tem interface gráfica com painéis arrastáveis, visualizador de diff, preview de HTML inline, terminal integrado e editor de arquivos. Você acessa pela aba **Code** dentro do app Claude.

> **Importante:** no app desktop, você **seleciona a pasta do projeto** e o Claude lê, edita e salva os arquivos diretamente nela. É exatamente o fluxo ideal para o FinControl.

### 10.2 Download e instalação

- **macOS:** [claude.ai/download](https://claude.ai/download) → baixar o instalador universal (Intel + Apple Silicon)
- **Windows:** mesmo link → baixar o instalador x64 (ou ARM64 se seu processador for ARM)
- **Linux:** não tem versão desktop nativa — use o CLI no terminal

Após instalar: abra o app Claude → clique na aba **Code** na barra superior.

> Requer plano **Pro** ou superior. No Windows, o Git for Windows também precisa estar instalado — o app vai avisar e pedir na primeira vez.

### 10.3 Configurar a pasta do projeto

**Passo a passo único — faça antes da primeira sessão:**

1. Crie uma pasta chamada `fincontrol` em qualquer lugar do seu computador
2. Coloque os arquivos dentro dela:
   ```
   fincontrol/
   ├── fincontrol-dashboard.html
   ├── fincontrol-mobile.html
   ├── fincontrol-manual.docx
   ├── handoff.md           ← este documento
   └── CLAUDE.md            ← criar agora (ver seção 10.4)
   ```
3. No app Claude Code: clique em **New Session** → selecione a pasta `fincontrol` como **Project folder**

### 10.4 Criar o arquivo CLAUDE.md

Este arquivo é lido automaticamente pelo Claude Code a cada sessão — funciona como a memória do projeto. Crie `CLAUDE.md` dentro da pasta `fincontrol` com o conteúdo abaixo:

```markdown
# FinControl — Instruções para Claude Code

## O que é este projeto
Sistema de controle financeiro pessoal de Fernando de Araújo Meira.
Dois arquivos HTML standalone com JavaScript e CSS inline, sem servidor.
Dados persistidos em localStorage com chave 'fincontrol_v3'.

## Arquivos do projeto
- fincontrol-dashboard.html — Painel Web completo (desktop/Chrome)
- fincontrol-mobile.html   — App Mobile PWA (Android/iOS/Chrome)
- handoff.md               — Arquitetura, bugs e próximos passos
- CLAUDE.md                — Este arquivo de instruções

## Regras de desenvolvimento

### Schema de dados — regras críticas
- SEMPRE usar `type` em operations[] dos investimentos (NUNCA `kind`)
- SEMPRE usar `recurrents` como array canônico (não apenas `recurring`)
- IDs gerados com: crypto.randomUUID() || (Date.now() + Math.floor(Math.random()*100000))
- A função inM(t, m, y) deve retornar false se t.skipped === true
- localStorage key não muda: sempre 'fincontrol_v3'
- meta.version deve ser 3 em ambos os arquivos (dashboard gerava 4 — BUG-01)

### Design — não alterar sem motivo
- Dark-first, sem modo claro
- Paleta: --bg #0a0a0a | --cu #b87333 (copper/acento) | --gn #34c77b | --rd #d95f5f
- Fonte: -apple-system, 'Segoe UI', system-ui (SEM Google Fonts CDN)
- Border-radius: --r 11px | --r-sm 7px | --r-lg 16px
- Profundidade por tom de fundo (s1/s2/s3), nunca box-shadow

### Chart.js — regras obrigatórias
- SEMPRE envolver <canvas> em <div style="position:relative;height:Npx;width:100%">
- SEMPRE usar responsive:true + maintainAspectRatio:false
- SEMPRE chamar killChart(id) antes de criar novo chart no mesmo canvas

### Dados do usuário
- Moeda: BRL — formato R$ 1.234,56
- Data: ISO interno YYYY-MM-DD, exibição "15 Jun 2025"
- Estado global de mês: curM (0-11) e curY

## O que NÃO fazer
- Não adicionar dependências CDN sem necessidade explícita
- Não alterar a chave localStorage 'fincontrol_v3'
- Não quebrar a sync automática entre dashboard e mobile
- Não implementar backend (exceto Google Drive OAuth quando solicitado)
- Não alterar o design system sem instrução explícita
```

### 10.5 Como funciona uma sessão no app desktop

O app tem os seguintes painéis (todos arrastáveis e redimensionáveis):

| Painel | O que faz |
|--------|-----------|
| **Chat** | Onde você digita as tarefas e vê as respostas |
| **Diff** | Mostra exatamente o que o Claude alterou em cada arquivo |
| **Preview** | Abre arquivos HTML diretamente — você vê o app rodando sem abrir o browser |
| **Terminal** | Terminal integrado na pasta do projeto |
| **File editor** | Abre arquivos para edição manual rápida |

**Fluxo recomendado para o FinControl:**
1. Abra uma sessão apontando para a pasta `fincontrol/`
2. Comece com o modo **Plan** (Claude lê e propõe um plano sem editar nada)
3. Revise o plano, aprove
4. Mude para **Auto accept edits** para executar
5. Use o painel **Preview** para abrir o HTML e testar no mesmo app
6. Revise o diff antes de confirmar que está ok

### 10.6 Modos de permissão — qual usar

| Modo | Quando usar |
|------|-------------|
| **Ask permissions** | Primeira vez, tarefas novas — Claude pergunta antes de cada edição |
| **Plan mode** | Para tarefas complexas — Claude mapeia o que vai fazer antes de tocar no código |
| **Auto accept edits** | Quando já entende o que vai ser feito — Claude edita sem perguntar |
| **Auto** | Sessões longas de desenvolvimento — menos interrupções |

> Para o FinControl, **comece com Plan mode** para cada etapa nova. Aprove o plano e então mude para Auto accept edits.

### 10.7 Preview de HTML no app — vantagem principal

O painel **Preview** abre arquivos HTML estáticos diretamente, **sem precisar abrir o browser**. Para o FinControl:

- Clique no caminho do arquivo no chat (ex: `fincontrol-dashboard.html`) → abre no preview
- Ou arraste o arquivo do editor para o painel preview
- O preview mantém o localStorage entre recarregamentos dentro da sessão
- Você pode interagir com o app (clicar botões, digitar) direto no painel

### 10.8 Prompts para usar na primeira sessão

**Iniciar lendo o contexto (sempre fazer isso primeiro):**
```
Leia o handoff.md e me dê um resumo do estado atual do projeto:
quais bugs críticos existem e qual deve ser o primeiro passo.
```

**Para a Etapa 1 completa (bugs críticos):**
```
Leia o handoff.md, seção "Etapa 1".
Corrija os 5 passos em ordem, um por vez.
Após cada passo, mostre o diff e espere minha aprovação antes do próximo.
```

**Para um passo específico:**
```
Corrija apenas o BUG-03 do handoff.md (operations[].kind → type).
Use Plan mode primeiro para me mostrar o que vai mudar.
```

**Para adicionar feature:**
```
Leia o handoff.md, Etapa 3, Passo 3.1.
Adicione o campo de busca na aba Lançamentos do fincontrol-mobile.html.
Após editar, abra o arquivo no preview para eu testar.
```

**Para revisar o resultado:**
```
Abra o fincontrol-dashboard.html no preview.
Verifique se os gráficos estão renderizando corretamente.
```

### 10.9 Dicas práticas para o app desktop

| ✅ Fazer | ❌ Evitar |
|---------|---------|
| Começar com Plan mode para tarefas complexas | Pedir tudo de uma vez sem revisar |
| Revisar o diff antes de aprovar cada mudança | Aprovar sem ler o que mudou |
| Testar no painel Preview após cada alteração | Só testar no final de muitas mudanças |
| Aprovar passo a passo (Etapa 1.1, testar, 1.2, testar...) | Pedir as 5 etapas de uma vez |
| Usar @handoff.md para referenciar o documento | Reexplicar o contexto a cada sessão |
| Manter o CLAUDE.md atualizado conforme o projeto evolui | Deixar o CLAUDE.md desatualizado |

### 10.10 Side Chat — para dúvidas rápidas sem perder contexto

No app desktop, `Cmd+;` (macOS) ou `Ctrl+;` (Windows) abre um **Side Chat** — uma conversa lateral que usa o contexto da sessão atual sem interromper o trabalho em andamento.

Use para:
- "Qual é a função que calcula o lucro dos investimentos?"
- "Como funciona o inM() atual?"
- "Quais arquivos foram editados até agora nesta sessão?"

### 10.11 Checklist para a primeira sessão

- [ ] Instalei o Claude Desktop (claude.ai/download)
- [ ] Criei a pasta `fincontrol/` com os 4 arquivos (dashboard, mobile, handoff.md, CLAUDE.md)
- [ ] Criei o `CLAUDE.md` com o conteúdo da seção 10.4
- [ ] Abri o app → aba Code → New Session → selecionei a pasta `fincontrol/`
- [ ] Primeiro prompt: "Leia o handoff.md e me dê um resumo do estado atual"
- [ ] Segundo prompt: "Corrija o BUG-01 (meta.version) usando Plan mode primeiro"

---

## 11. Contexto financeiro do usuário

Para manter os dados de seed corretos e contextualizados:

### Rendas

| Fonte | Tipo | Valor | Dia |
|-------|------|-------|-----|
| Salário | Fixo | R$ 8.500 | Dia 5 |
| Comissão | Variável | ~R$ 700–1.600 | Dia 5 |
| Benefício refeição | Fixo | R$ 600 | Dia 5 |

### Despesas recorrentes

| Despesa | Tipo | Valor | Dia |
|---------|------|-------|-----|
| Aluguel | Fixo | R$ 1.800 | Dia 10 |
| Netflix + Spotify | Cartão | R$ 85 | Dia 7 |
| Combustível | Variável | ~R$ 200–350 | Dia 14 |

### Contas bancárias

| Conta | Banco | Tipo |
|-------|-------|------|
| Conta Corrente | Nubank | checking |
| Poupança | Inter | savings |
| Carteira | Dinheiro | cash |

### Cartões

| Cartão | Limite | Fecha | Vence |
|--------|--------|-------|-------|
| Nubank | R$ 8.000 | Dia 1 | Dia 8 |
| Inter | R$ 5.000 | Dia 15 | Dia 22 |

### Investimentos

| Ativo | Tipo | Valor aprox. | Rentab. |
|-------|------|-------------|---------|
| CDB Banco Inter | Renda Fixa | R$ 15.000 | 12,5% a.a. |
| Tesouro Selic | Renda Fixa | R$ 8.000 | 10,8% a.a. |
| IVVB11 | Ações/ETF | R$ 5.500 | 18,2% a.a. |
| FII XPML11 | FII | R$ 3.200 | 9,4% a.a. |

---

## Apêndice — Checklist de handoff

Antes de começar a trabalhar no Claude Code, verifique:

- [ ] Baixei os 3 arquivos: `fincontrol-dashboard.html`, `fincontrol-mobile.html`, `handoff.md`
- [ ] Criei a pasta `fincontrol/` e coloquei os arquivos nela
- [ ] Criei o `CLAUDE.md` com as instruções persistentes (seção 10.4)
- [ ] Instalei Claude Code: `npm install -g @anthropic-ai/claude-code`
- [ ] Testei que os dois HTMLs abrem corretamente no Chrome local
- [ ] Confirmi que os dados persistem entre recarregamentos (localStorage funcionando)
- [ ] Li os bugs da Etapa 1 — estes devem ser corrigidos primeiro

**Ordem recomendada para a primeira sessão no Claude Code:**
1. Corrija Etapa 1, Passos 1.1 → 1.5 (bugs críticos de schema)
2. Teste manualmente no browser
3. Inicie Etapa 2, Passo 2.1 (shared schema)

---

*Documento gerado em Junho 2025 — FinControl v3*

---

## Apêndice B — Limitações técnicas conhecidas e caminhos de resolução

### B1 — Widget de tela inicial (home screen widget)

**O que foi entregue (Fase 3):**
Os três arquivos do projeto (`manifest.json`, `fincontrol-mobile.html`, `fincontrol-dashboard.html`) foram configurados com **PWA Shortcuts** — atalhos que aparecem ao pressionar e segurar o ícone do app instalado no Android/iOS. São três atalhos:
- *Novo Lançamento* → abre diretamente o sheet de novo gasto
- *Ver Saldo* → abre o app na home
- *Dashboard* → abre a versão desktop

**O que NÃO foi entregue e por quê:**
O card do roadmap descreve *"saldo do mês e botão rápido de lançamento, **sem abrir o app**"* — ou seja, um widget visual que vive na tela inicial e exibe dados ao vivo sem o usuário abrir o aplicativo. Isso **não é possível com PWA/HTML puro** hoje:

| Tecnologia | Plataforma | Limitação |
|---|---|---|
| PWA Shortcuts | Android + iOS 16.4+ | Só atalhos de navegação — não exibe dados |
| Web Periodic Background Sync | Chrome Android (limitado) | Atualiza dados, mas não renderiza widget |
| Glance API / App Widget | Android nativo | Requer app nativo (não disponível em PWA) |
| WidgetKit | iOS nativo | Requer app Swift/SwiftUI — sem acesso ao HTML |

**Caminhos para resolver no futuro:**

**Opção 1 — Capacitor (recomendado se quiser ir nativo sem reescrever)**
Envolva os HTMLs atuais com [Capacitor](https://capacitorjs.com/). O Capacitor cria um app nativo (APK/IPA) a partir de HTML/JS e permite adicionar plugins nativos, incluindo widgets:
- Plugin Android: `@capacitor-community/android-widgets` ou widget nativo via Java/Kotlin acessando o `localStorage` do WebView via bridge
- Plugin iOS: `WidgetKit` via extensão Swift que lê um `App Group` compartilhado com o WebView
- Custo: ~2-3 dias de trabalho para empacotar + ~1 semana para o widget nativo

**Opção 2 — React Native + WebView híbrido**
Reescrever as telas críticas (home, lançamento rápido) em React Native e manter o dashboard como WebView. O widget nativo é criado na camada React Native, lê o `AsyncStorage` e exibe saldo. Custo alto — implica migração parcial.

**Opção 3 — Aguardar evolução do padrão**
A proposta [CSS Houdini Worklets + Badging API](https://web.dev/) e o [Fugu Project](https://fugu-tracker.web.app/) do Google estão expandindo as capacidades das PWAs. Widgets de tela inicial para PWA estão em discussão no W3C mas sem data definida para suporte universal.

**Recomendação para Fernando:** Se o widget for uma prioridade, a Opção 1 (Capacitor) é a que melhor preserva o investimento atual — os HTMLs continuam intactos e o Capacitor apenas os empacota. O widget nativo receberia os dados via um pequeno bridge JS → nativo.
