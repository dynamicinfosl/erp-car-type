# ERP Car Type

Sistema ERP para oficinas e prestadores de serviços automotivos. Inclui gestão de clientes, veículos, ordens de serviço, vendas, PDV, estoque, financeiro e integração com emissão de notas fiscais (Focus NFe).

## Tecnologias

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS
- **Backend / Auth / Banco:** [Supabase](https://supabase.com) (PostgreSQL, Auth, Edge Functions)
- **Pagamentos:** Stripe
- **Notas fiscais:** Focus NFe (NF-e / NFSe)
- **Deploy:** Vercel (recomendado)

## Pré-requisitos

- [Node.js](https://nodejs.org/) 18+ (recomendado LTS)
- [npm](https://www.npmjs.com/) ou [pnpm](https://pnpm.io/)
- Conta no [Supabase](https://supabase.com)
- (Opcional) Conta na [Focus NFe](https://focusnfe.com.br) para emissão de notas

---

## Instalação

### 1. Clonar o repositório

```bash
git clone <url-do-repositorio>
cd erp-car-type
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto com as variáveis do Supabase:

```env
VITE_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
```

**Onde obter:**

- Acesse [Supabase Dashboard](https://app.supabase.com) → seu projeto
- **Settings** → **API** → use **Project URL** e **anon public** (key pública)

> **Importante:** Não commite o arquivo `.env`. Ele já deve estar no `.gitignore`.

### 4. Configurar o Supabase

- Crie um projeto no Supabase (se ainda não tiver).
- No projeto, vá em **SQL Editor** e execute os scripts de criação das tabelas e políticas (RLS) que o sistema utiliza (clientes, veículos, ordens de serviço, vendas, produtos, estoque, financeiro, configurações da empresa, usuários etc.).
- Para habilitar **mecânico responsável e comissionamento em ordens de serviço**, execute também o script:
  - `supabase/ADD_MECHANIC_COMMISSION.sql`
- As **Edge Functions** em `supabase/functions/` precisam ser implantadas no seu projeto para:
  - Criação de usuários do sistema (`create-system-user`)
  - Integração Focus NFe: emissão, consulta de status, webhook e teste de conexão (`focus-nfe-*`, `download-nfse-file`).

Para implantar as functions (com [Supabase CLI](https://supabase.com/docs/guides/cli) instalado e logado):

```bash
supabase functions deploy create-system-user
supabase functions deploy focus-nfe-emit-nfe-service
supabase functions deploy focus-nfe-consult-nfse-status
supabase functions deploy focus-nfe-webhook
supabase functions deploy focus-nfe-test-connection
supabase functions deploy download-nfse-file
```

Configure as **secrets** das functions no dashboard (por exemplo token Focus NFe, se usado pela function).

### 5. Rodar em desenvolvimento

```bash
npm run dev
```

A aplicação sobe em **http://localhost:3000**.

### 6. Build para produção

```bash
npm run build
```

A saída fica em `dist/`. Para testar localmente:

```bash
npm run preview
```

---

## Deploy (Vercel)

1. Conecte o repositório ao [Vercel](https://vercel.com).
2. Nas **Environment Variables** do projeto, defina:
   - `VITE_PUBLIC_SUPABASE_URL`
   - `VITE_PUBLIC_SUPABASE_ANON_KEY`
3. O `vercel.json` na raiz já está configurado com rewrite para SPA (`index.html`).
4. Faça o deploy; o comando de build padrão é `npm run build` e o output é `dist/`.

---

## Estrutura do projeto

```
erp-car-type/
├── public/           # Arquivos estáticos e configs de deploy
├── src/
│   ├── components/   # Componentes reutilizáveis (layout, modais, toast, etc.)
│   ├── i18n/         # Internacionalização
│   ├── lib/          # Cliente Supabase e tipos
│   ├── pages/        # Páginas (dashboard, clientes, vendas, PDV, ordens de serviço, etc.)
│   ├── router/       # Rotas da aplicação
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── supabase/
│   └── functions/    # Edge Functions (usuários, Focus NFe, download NFSe)
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── README.md
```

---

## Funcionalidades principais

- **Dashboard** – Visão geral e indicadores
- **Clientes e veículos** – Cadastro e histórico
- **Agendamentos** – Agenda de serviços
- **Ordens de serviço** – Diagnóstico, orçamento, status e entrega
- **Vendas e PDV** – Vendas e devoluções
- **Produtos e estoque** – Cadastro e controle de estoque
- **Notas fiscais** – Integração Focus NFe (emissão, consulta, webhook)
- **Financeiro** – Fluxo de caixa, contas a pagar/receber, despesas diárias
- **Relatórios** – Ex.: vendas por produto
- **Configurações** – Empresa e usuários (com Edge Function para criar usuário sistema)
- **Inbox** – Mensagens/conversas com clientes

---

## Integração Focus NFe

A emissão e o acompanhamento de NF-e/NFSe são feitos via Focus NFe. No sistema, as configurações da empresa (token, ambiente homologação/produção) são usadas pelas Edge Functions.

Para detalhes da integração e do webhook, consulte:

- `ANALISE_INTEGRACAO_FOCUS_NFE.md`
- `CONFIGURACAO_WEBHOOK_FOCUS_NFE.md`

---

## Scripts disponíveis

| Comando           | Descrição                    |
|-------------------|------------------------------|
| `npm run dev`     | Sobe o servidor de desenvolvimento (porta 3000) |
| `npm run build`   | Gera o build de produção em `dist/` |
| `npm run preview` | Serve o conteúdo de `dist/` localmente |

---

## Licença

Projeto privado. Uso conforme definido pelo titular do repositório.
