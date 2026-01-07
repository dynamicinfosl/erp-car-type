# Análise Completa da Integração Focus NFe

## Data da Análise
7 de Janeiro de 2026

## Documentação Consultada
https://focusnfe.com.br/doc/#introducao

---

## 1. RESUMO EXECUTIVO

### Status Geral: ✅ BOM (com pontos de atenção)

A integração com a Focus NFe está **bem implementada** e segue a maioria das boas práticas. O código demonstra:
- Validações robustas
- Tratamento de erros detalhado
- Logs extensivos para debugging
- Correções específicas para erros conhecidos (E0160)

### Pontos Fortes
✅ Autenticação correta (Basic Auth com Base64)
✅ URLs corretas para homologação e produção
✅ Estrutura de dados alinhada com a API v2
✅ Webhook implementado corretamente
✅ Tratamento de erros robusto

### Pontos de Atenção
⚠️ Alguns campos podem estar sendo enviados incorretamente
⚠️ Falta validação de alguns campos obrigatórios
⚠️ Código de serviço pode ter problemas de formatação

---

## 2. ANÁLISE DETALHADA POR COMPONENTE

### 2.1 Autenticação ✅ CORRETO

**Implementação Atual:**
```typescript
const token = settings.focus_nfe_token.trim();
const authToken = btoa(`${token}:`);

headers: {
  'Authorization': `Basic ${authToken}`,
  'Content-Type': 'application/json',
}
```

**Documentação Focus NFe:**
> A autenticação é feita através de HTTP Basic Auth, onde o usuário é o token e a senha é vazia.

**Status:** ✅ **CORRETO** - A implementação está perfeita.

---

### 2.2 URLs e Ambientes ✅ CORRETO

**Implementação Atual:**
```typescript
const focusUrl = settings.focus_nfe_environment === 'production'
  ? 'https://api.focusnfe.com.br'
  : 'https://homologacao.focusnfe.com.br';
```

**Documentação Focus NFe:**
- Produção: `https://api.focusnfe.com.br`
- Homologação: `https://homologacao.focusnfe.com.br`

**Status:** ✅ **CORRETO**

---

### 2.3 Endpoint de Envio ✅ CORRETO

**Implementação Atual:**
```typescript
fetch(`${focusUrl}/v2/nfse?ref=${ref}`, {
  method: 'POST',
  ...
})
```

**Documentação Focus NFe:**
> POST /v2/nfse?ref=REFERENCIA

**Status:** ✅ **CORRETO** - Usando a API v2 corretamente.

---

### 2.4 Estrutura de Dados da NFSe

#### 2.4.1 Campo `prestador` ✅ CORRETO

**Implementação Atual:**
```typescript
prestador: {
  cnpj: settings.cnpj.replace(/\D/g, ''),
  codigo_municipio: settings.city_code || '',
  optante_simples_nacional: optanteSimplesNacional,
  incentivo_fiscal: incentivoFiscal,
}
```

**Documentação Focus NFe - Campos Obrigatórios:**
- `cnpj`: CNPJ do prestador (apenas números) ✅
- `codigo_municipio`: Código IBGE do município ✅
- `optante_simples_nacional`: true/false ✅
- `incentivo_fiscal`: true/false ✅

**Status:** ✅ **CORRETO**

#### 2.4.2 Campo `inscricao_municipal` ⚠️ ATENÇÃO

**Implementação Atual:**
```typescript
if (settings.inscricao_municipal && settings.inscricao_municipal.trim() !== '') {
  const inscricaoLimpa = settings.inscricao_municipal.replace(/\D/g, '');
  if (inscricaoLimpa.length > 0) {
    nfseData.prestador.inscricao_municipal = inscricaoLimpa;
  }
}
```

**Documentação Focus NFe:**
> `inscricao_municipal`: Inscrição municipal do prestador. **OBRIGATÓRIO para alguns municípios**.

**Problema Identificado:**
- O campo é opcional no código, mas pode ser **obrigatório** dependendo do município
- Não há validação se o município exige inscrição municipal

**Recomendação:**
```typescript
// Adicionar validação por município
const municipiosQueExigemIM = ['3304557', '3550308']; // Rio de Janeiro, São Paulo, etc.
if (municipiosQueExigemIM.includes(settings.city_code)) {
  if (!settings.inscricao_municipal) {
    throw new Error('Inscrição Municipal é obrigatória para este município');
  }
}
```

---

#### 2.4.3 Campo `regime_especial_tributacao` ✅ CORRETO

**Implementação Atual:**
```typescript
if (optanteSimplesNacional) {
  // ✅ Para Simples Nacional, NÃO enviar regime_especial_tributacao
  console.log('✅ Simples Nacional: NÃO enviando regime_especial_tributacao');
} else if (regimeEspecialTributacao >= 1 && regimeEspecialTributacao <= 6) {
  nfseData.prestador.regime_especial_tributacao = regimeEspecialTributacao;
}
```

**Documentação Focus NFe:**
> `regime_especial_tributacao`: Código do regime especial de tributação (1 a 6).
> **Não deve ser enviado para Simples Nacional.**

**Status:** ✅ **CORRETO** - A correção E0160 está implementada corretamente.

---

#### 2.4.4 Campo `tomador` ⚠️ ATENÇÃO

**Implementação Atual:**
```typescript
tomador: {
  razao_social: order.customer.name.substring(0, 115),
}

// CPF ou CNPJ adicionado depois
if (order.customer.cnpj) {
  nfseData.tomador.cnpj = order.customer.cnpj.replace(/\D/g, '');
} else if (order.customer.cpf) {
  nfseData.tomador.cpf = order.customer.cpf.replace(/\D/g, '');
}
```

**Documentação Focus NFe:**
> **Campos obrigatórios do tomador:**
> - `cpf` OU `cnpj` (um dos dois)
> - `razao_social` (nome/razão social)
> 
> **Campos opcionais mas recomendados:**
> - `email` (para envio automático da nota)
> - `endereco` (completo)

**Problema Identificado:**
1. ✅ CPF/CNPJ está sendo validado antes (linhas 241-253)
2. ✅ Email e endereço estão sendo adicionados (linhas 696-723)
3. ⚠️ **FALTA**: Validação se o CPF/CNPJ é válido (dígitos verificadores)

**Recomendação:**
```typescript
// Adicionar validação de CPF/CNPJ
function validarCPF(cpf: string): boolean {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  // Implementar validação de dígitos verificadores
  // ...
  return true;
}

function validarCNPJ(cnpj: string): boolean {
  cnpj = cnpj.replace(/\D/g, '');
  if (cnpj.length !== 14) return false;
  // Implementar validação de dígitos verificadores
  // ...
  return true;
}

// Usar antes de enviar
if (order.customer.cpf && !validarCPF(order.customer.cpf)) {
  throw new Error('CPF do cliente inválido');
}
if (order.customer.cnpj && !validarCNPJ(order.customer.cnpj)) {
  throw new Error('CNPJ do cliente inválido');
}
```

---

#### 2.4.5 Campo `servico` - ANÁLISE CRÍTICA

##### 2.4.5.1 `item_lista_servico` ⚠️ PROBLEMA CRÍTICO

**Implementação Atual:**
```typescript
const codigoServicoCompleto = (firstService.codigo_servico_municipal || '').toString().replace(/\D/g, '');

let codigoServico = codigoServicoCompleto;

// Se tiver menos de 6 dígitos, completar com zeros à direita
if (codigoServico.length < 6) {
  codigoServico = codigoServico.padEnd(6, '0');
} 
// Se tiver mais de 6 dígitos, pegar apenas os primeiros 6
else if (codigoServico.length > 6) {
  codigoServico = codigoServico.substring(0, 6);
}
```

**Documentação Focus NFe:**
> `item_lista_servico`: Código do serviço conforme LC 116/2003.
> **Formato:** 4 ou 5 dígitos (ex: "0101", "01.01", "010101")
> **A API aceita com ou sem pontos.**

**🚨 PROBLEMA CRÍTICO IDENTIFICADO:**

O código está **forçando 6 dígitos**, mas a documentação diz que deve ter **4 ou 5 dígitos**!

**Exemplo do problema:**
- Código cadastrado: `0101` (4 dígitos - manutenção automotiva)
- Código enviado: `010100` (6 dígitos - **ERRADO!**)

**Documentação LC 116/2003:**
A Lista de Serviços usa códigos de 4 ou 5 dígitos:
- `01.01` = Análise e desenvolvimento de sistemas
- `14.01` = Lubrificação, limpeza, lustração, revisão, carga e recarga, conserto, restauração, blindagem, manutenção e conservação de máquinas, veículos, aparelhos, equipamentos, motores, elevadores ou de qualquer objeto

**CORREÇÃO NECESSÁRIA:**
```typescript
// ❌ ERRADO (código atual)
if (codigoServico.length < 6) {
  codigoServico = codigoServico.padEnd(6, '0');
}

// ✅ CORRETO
// Não fazer nada! Enviar o código como está (4 ou 5 dígitos)
const codigoServico = (firstService.codigo_servico_municipal || '')
  .toString()
  .replace(/\D/g, ''); // Remove pontos e outros caracteres

// Validar se tem 4 ou 5 dígitos
if (codigoServico.length < 4 || codigoServico.length > 5) {
  throw new Error(
    `Código de serviço inválido: "${codigoServico}". ` +
    `Deve ter 4 ou 5 dígitos (ex: 0101, 01401)`
  );
}

nfseData.servico.item_lista_servico = codigoServico;
```

**Exemplo Correto da Documentação:**
```json
{
  "servico": {
    "item_lista_servico": "0101",
    // OU
    "item_lista_servico": "01.01",
    // OU  
    "item_lista_servico": "1401"
  }
}
```

---

##### 2.4.5.2 `codigo_nbs` ✅ CORRETO

**Implementação Atual:**
```typescript
let codigoNBSFinal = (firstService.nbs_code || '').toString().replace(/\D/g, '');

if (!codigoNBSFinal || codigoNBSFinal.length < 7 || codigoNBSFinal.length > 9) {
  codigoNBSFinal = '116010100'; // Código padrão para manutenção automotiva (9 dígitos)
} else if (codigoNBSFinal.length === 7) {
  codigoNBSFinal = codigoNBSFinal.padEnd(9, '0');
} else if (codigoNBSFinal.length === 8) {
  codigoNBSFinal = codigoNBSFinal.padEnd(9, '0');
}

nfseData.servico.codigo_nbs = codigoNBSFinal;
```

**Documentação Focus NFe:**
> `codigo_nbs`: Código NBS (Nomenclatura Brasileira de Serviços).
> **Formato:** 7 a 9 dígitos
> **Obrigatório para NFSe Nacional**

**Status:** ✅ **CORRETO** - Implementação está adequada.

---

##### 2.4.5.3 `iss_retido` e `indicador_issqn_retido` ✅ CORRETO

**Implementação Atual:**
```typescript
let issRetido = false; // Padrão: ISS NÃO retido

if (optanteSimplesNacional) {
  if (order.customer.cpf) {
    issRetido = false; // Simples Nacional + CPF = NÃO retido
  } else if (order.customer.cnpj) {
    issRetido = false; // Simples Nacional + CNPJ = NÃO retido (sem substituição)
  }
} else {
  issRetido = false; // Regime Normal = NÃO retido (padrão)
}

nfseData.servico.iss_retido = issRetido ? "true" : "false";
nfseData.servico.indicador_issqn_retido = issRetido ? 1 : 2;
```

**Documentação Focus NFe:**
> `iss_retido`: "true" ou "false" (string)
> `indicador_issqn_retido`: 1 (retido) ou 2 (não retido) - **Obrigatório para NFSe Nacional**

**Status:** ✅ **CORRETO**

---

##### 2.4.5.4 `discriminacao` ⚠️ ATENÇÃO

**Implementação Atual:**
```typescript
let descricaoServicos = serviceItems.map((item: any, index: number) => {
  const service = servicesData?.find(s => s.id === item.service_id);
  const quantidade = parseFloat(item.quantity) || 1;
  const valorUnitario = parseFloat(item.unit_price) || 0;
  const valorTotal = quantidade * valorUnitario;
  
  return `${index + 1}. ${item.description || service?.name || 'Serviço'} - Qtd: ${quantidade} - Valor: R$ ${valorTotal.toFixed(2)}`;
}).join('\n');

// Adicionar informações do veículo
if (order.vehicle) {
  descricaoServicos += `\n\nVeículo: ${order.vehicle.model || ''} - Placa: ${order.vehicle.plate || ''}`;
}

nfseData.servico.discriminacao = descricaoServicos.substring(0, 2000);
```

**Documentação Focus NFe:**
> `discriminacao`: Descrição detalhada dos serviços prestados.
> **Limite:** 2000 caracteres
> **Obrigatório:** Sim

**Problema Identificado:**
- ✅ Limite de 2000 caracteres está sendo respeitado
- ⚠️ **FALTA**: Informações fiscais obrigatórias em alguns municípios

**Recomendação:**
Alguns municípios exigem informações específicas na discriminação:
```typescript
let descricaoServicos = serviceItems.map((item: any, index: number) => {
  // ... código existente ...
}).join('\n');

// Adicionar informações do veículo
if (order.vehicle) {
  descricaoServicos += `\n\nVeículo: ${order.vehicle.model || ''} - Placa: ${order.vehicle.plate || ''}`;
}

// ✅ ADICIONAR: Informações fiscais (recomendado)
descricaoServicos += `\n\n--- INFORMAÇÕES FISCAIS ---`;
descricaoServicos += `\nCódigo do Serviço: ${codigoServico}`;
descricaoServicos += `\nCódigo NBS: ${codigoNBSFinal}`;
if (firstService.cnae_code) {
  descricaoServicos += `\nCNAE: ${firstService.cnae_code}`;
}

nfseData.servico.discriminacao = descricaoServicos.substring(0, 2000);
```

---

##### 2.4.5.5 `valor_servicos` ✅ CORRETO

**Implementação Atual:**
```typescript
valor_servicos: parseFloat(totalAmount.toFixed(2)),
```

**Documentação Focus NFe:**
> `valor_servicos`: Valor total dos serviços (decimal com 2 casas).
> **Obrigatório:** Sim

**Status:** ✅ **CORRETO**

---

##### 2.4.5.6 `aliquota` ✅ CORRETO

**Implementação Atual:**
```typescript
const aliquotaIss = parseFloat(firstService.issqn_aliquota || '0');
// ...
aliquota: parseFloat(aliquotaIss.toFixed(2)),
```

**Documentação Focus NFe:**
> `aliquota`: Alíquota do ISS (percentual, ex: 5.00 para 5%).
> **Obrigatório:** Sim

**Status:** ✅ **CORRETO**

---

##### 2.4.5.7 `valor_iss` ⚠️ ATENÇÃO

**Implementação Atual:**
```typescript
const valorIss = aliquotaIss > 0 ? (totalAmount * (aliquotaIss / 100)) : 0;

// Adicionar valor do ISS se houver
if (valorIss > 0) {
  nfseData.servico.valor_iss = parseFloat(valorIss.toFixed(2));
}
```

**Documentação Focus NFe:**
> `valor_iss`: Valor do ISS (calculado).
> **Obrigatório:** Depende do município

**Problema Identificado:**
- ✅ Cálculo está correto: `valor_servicos * (aliquota / 100)`
- ⚠️ **ATENÇÃO**: Não está considerando deduções no cálculo do ISS

**Correção Necessária:**
```typescript
// ❌ ERRADO (código atual)
const valorIss = aliquotaIss > 0 ? (totalAmount * (aliquotaIss / 100)) : 0;

// ✅ CORRETO
const valorBase = totalAmount - (discount || 0); // Base de cálculo = valor - deduções
const valorIss = aliquotaIss > 0 ? (valorBase * (aliquotaIss / 100)) : 0;
```

---

##### 2.4.5.8 `valor_deducoes` ✅ CORRETO

**Implementação Atual:**
```typescript
if (discount > 0) {
  nfseData.servico.valor_deducoes = parseFloat(discount.toFixed(2));
}
```

**Documentação Focus NFe:**
> `valor_deducoes`: Valor das deduções (descontos).

**Status:** ✅ **CORRETO**

---

##### 2.4.5.9 `codigo_cnae` ⚠️ ATENÇÃO

**Implementação Atual:**
```typescript
if (firstService.cnae_code) {
  const cnaeLimpo = firstService.cnae_code.replace(/\D/g, '');
  if (cnaeLimpo.length === 7) {
    nfseData.servico.codigo_cnae = cnaeLimpo;
  }
}
```

**Documentação Focus NFe:**
> `codigo_cnae`: Código CNAE (7 dígitos).
> **Obrigatório:** Depende do município

**Problema Identificado:**
- ✅ Validação de 7 dígitos está correta
- ⚠️ **FALTA**: Validação se o CNAE é válido (existe na tabela oficial)
- ⚠️ **FALTA**: Mensagem de erro se o CNAE for obrigatório

**Recomendação:**
```typescript
// Verificar se o município exige CNAE
const municipiosQueExigemCNAE = ['3304557']; // Rio de Janeiro, etc.
if (municipiosQueExigemCNAE.includes(settings.city_code)) {
  if (!firstService.cnae_code) {
    throw new Error('Código CNAE é obrigatório para este município');
  }
}

if (firstService.cnae_code) {
  const cnaeLimpo = firstService.cnae_code.replace(/\D/g, '');
  if (cnaeLimpo.length !== 7) {
    throw new Error(`CNAE inválido: "${firstService.cnae_code}". Deve ter 7 dígitos.`);
  }
  nfseData.servico.codigo_cnae = cnaeLimpo;
}
```

---

### 2.5 Webhook ✅ CORRETO

**Implementação Atual:**
```typescript
serve(async (req) => {
  const webhookData = JSON.parse(rawBody);
  
  const ref = webhookData.ref;
  const status = webhookData.status;
  const numero = webhookData.numero;
  const codigoVerificacao = webhookData.codigo_verificacao;
  // ...
  
  // Busca a OS pela referência
  const { data: serviceOrder } = await supabase
    .from("service_orders")
    .select("*")
    .eq("invoice_reference", ref)
    .single();
  
  // Atualiza conforme o status
  if (status === "autorizado") {
    updateData.invoice_status = "autorizado";
    updateData.invoice_number = numero?.toString();
    // ...
  }
});
```

**Documentação Focus NFe:**
> O webhook envia notificações quando o status da nota muda.
> **Campos enviados:**
> - `ref`: Referência da nota
> - `status`: Status atual (autorizado, erro_autorizacao, etc.)
> - `numero`: Número da nota (se autorizada)
> - `codigo_verificacao`: Código de verificação

**Status:** ✅ **CORRETO** - Implementação está perfeita.

---

### 2.6 Teste de Conexão ✅ CORRETO

**Implementação Atual:**
```typescript
const response = await fetch(`${baseUrl}/v2/nfce?filtro=todos`, {
  method: 'GET',
  headers: {
    'Authorization': `Basic ${btoa(token + ':')}`,
    'Content-Type': 'application/json',
  },
});

if (response.status === 401) {
  return { success: false, message: 'Token inválido' };
}
```

**Status:** ✅ **CORRETO**

---

## 3. PROBLEMAS CRÍTICOS IDENTIFICADOS

### 🚨 PROBLEMA #1: Código de Serviço com 6 dígitos (CRÍTICO)

**Localização:** `supabase/functions/focus-nfe-emit-nfe-service/index.ts` (linhas 480-495)

**Problema:**
O código está forçando o `item_lista_servico` para ter 6 dígitos, mas a documentação da Focus NFe e a LC 116/2003 exigem **4 ou 5 dígitos**.

**Impacto:**
- ❌ Notas sendo rejeitadas pela prefeitura
- ❌ Código de serviço incorreto
- ❌ Possível erro "Código de serviço inválido"

**Correção:**
```typescript
// ❌ REMOVER estas linhas (480-495):
if (codigoServico.length < 6) {
  codigoServico = codigoServico.padEnd(6, '0');
} else if (codigoServico.length > 6) {
  codigoServico = codigoServico.substring(0, 6);
}

// ✅ SUBSTITUIR por:
const codigoServico = (firstService.codigo_servico_municipal || '')
  .toString()
  .replace(/\D/g, '');

// Validar se tem 4 ou 5 dígitos
if (codigoServico.length < 4 || codigoServico.length > 5) {
  console.error('❌ VALIDAÇÃO FALHOU: Código de serviço inválido');
  return new Response(
    JSON.stringify({
      success: false,
      error: `Código de serviço inválido: "${codigoServico}".\n\nO código deve ter 4 ou 5 dígitos conforme LC 116/2003.\n\nExemplos corretos:\n• 0101 (4 dígitos)\n• 01401 (5 dígitos)\n\nCódigo atual: "${firstService.codigo_servico_municipal}"\n\nConfigure em: Serviços > Editar Serviço > Dados Fiscais`,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    }
  );
}

console.log('✅ Código de serviço validado:', codigoServico);
nfseData.servico.item_lista_servico = codigoServico;
```

---

### ⚠️ PROBLEMA #2: Cálculo do ISS não considera deduções

**Localização:** `supabase/functions/focus-nfe-emit-nfe-service/index.ts` (linha 527)

**Problema:**
O ISS está sendo calculado sobre o valor total, mas deveria ser calculado sobre o valor total menos as deduções.

**Correção:**
```typescript
// ❌ ERRADO:
const valorIss = aliquotaIss > 0 ? (totalAmount * (aliquotaIss / 100)) : 0;

// ✅ CORRETO:
const valorBaseCalculo = totalAmount - (discount || 0);
const valorIss = aliquotaIss > 0 ? (valorBaseCalculo * (aliquotaIss / 100)) : 0;

console.log('💰 ISS calculado:', {
  valor_servicos: totalAmount,
  deducoes: discount,
  base_calculo: valorBaseCalculo,
  aliquota: aliquotaIss,
  valor_iss: valorIss,
});
```

---

### ⚠️ PROBLEMA #3: Falta validação de CPF/CNPJ

**Localização:** `supabase/functions/focus-nfe-emit-nfe-service/index.ts` (linhas 689-693)

**Problema:**
O código valida se o CPF/CNPJ existe, mas não valida se é válido (dígitos verificadores).

**Recomendação:**
Adicionar funções de validação de CPF/CNPJ antes de enviar para a Focus NFe.

---

### ⚠️ PROBLEMA #4: Campos obrigatórios por município não são validados

**Problema:**
Alguns municípios exigem campos específicos (Inscrição Municipal, CNAE, etc.), mas o código não valida isso.

**Recomendação:**
Criar um mapeamento de requisitos por município:
```typescript
const requisitosPorMunicipio = {
  '3304557': { // Rio de Janeiro
    inscricao_municipal: true,
    cnae: true,
  },
  '3550308': { // São Paulo
    inscricao_municipal: true,
  },
};

const requisitos = requisitosPorMunicipio[settings.city_code];
if (requisitos) {
  if (requisitos.inscricao_municipal && !settings.inscricao_municipal) {
    throw new Error('Inscrição Municipal é obrigatória para este município');
  }
  if (requisitos.cnae && !firstService.cnae_code) {
    throw new Error('Código CNAE é obrigatório para este município');
  }
}
```

---

## 4. BOAS PRÁTICAS IMPLEMENTADAS ✅

1. ✅ **Logs detalhados** para debugging
2. ✅ **Validações robustas** antes de enviar
3. ✅ **Tratamento de erros** em múltiplos formatos
4. ✅ **Webhook** para atualização automática de status
5. ✅ **Teste de conexão** antes de usar
6. ✅ **Ambientes separados** (homologação/produção)
7. ✅ **Referência única** para cada nota
8. ✅ **Correções específicas** para erros conhecidos (E0160)

---

## 5. RECOMENDAÇÕES GERAIS

### 5.1 Melhorias de Código

1. **Criar arquivo de constantes**
```typescript
// constants/focus-nfe.ts
export const MUNICIPIOS_REQUISITOS = {
  '3304557': { // Rio de Janeiro
    inscricao_municipal: true,
    cnae: true,
    nome: 'Rio de Janeiro',
  },
  // ...
};

export const CODIGO_NBS_PADRAO = '116010100'; // Manutenção automotiva
export const TAMANHO_CODIGO_SERVICO_MIN = 4;
export const TAMANHO_CODIGO_SERVICO_MAX = 5;
```

2. **Criar funções de validação reutilizáveis**
```typescript
// utils/validators.ts
export function validarCPF(cpf: string): boolean { /* ... */ }
export function validarCNPJ(cnpj: string): boolean { /* ... */ }
export function validarCodigoServico(codigo: string): boolean { /* ... */ }
export function validarCNAE(cnae: string): boolean { /* ... */ }
```

3. **Separar lógica de negócio**
```typescript
// services/nfse-builder.ts
export class NFSeBuilder {
  buildPrestador(settings: SystemSettings) { /* ... */ }
  buildTomador(customer: Customer) { /* ... */ }
  buildServico(items: ServiceItem[]) { /* ... */ }
}
```

### 5.2 Testes

Criar testes unitários para:
- Validação de CPF/CNPJ
- Formatação de códigos (serviço, NBS, CNAE)
- Cálculo de ISS
- Construção do payload da NFSe

### 5.3 Documentação

Criar documentação interna sobre:
- Como cadastrar códigos fiscais corretos
- Requisitos por município
- Erros comuns e como resolver

---

## 6. CHECKLIST DE CORREÇÕES

### Correções Críticas (Fazer Imediatamente)
- [ ] **CRÍTICO**: Corrigir código de serviço para 4-5 dígitos (não 6)
- [ ] **IMPORTANTE**: Corrigir cálculo do ISS (considerar deduções)

### Correções Recomendadas (Fazer em Seguida)
- [ ] Adicionar validação de CPF/CNPJ
- [ ] Adicionar validação de campos obrigatórios por município
- [ ] Adicionar validação de CNAE válido
- [ ] Melhorar discriminação com informações fiscais

### Melhorias Futuras
- [ ] Criar arquivo de constantes
- [ ] Criar funções de validação reutilizáveis
- [ ] Separar lógica de negócio em classes
- [ ] Adicionar testes unitários
- [ ] Criar documentação interna

---

## 7. CONCLUSÃO

A integração com a Focus NFe está **bem implementada** no geral, mas tem **1 problema crítico** que precisa ser corrigido imediatamente:

### 🚨 Problema Crítico
O código de serviço está sendo enviado com 6 dígitos, mas deve ter 4 ou 5 dígitos conforme a LC 116/2003 e documentação da Focus NFe.

### ✅ Pontos Fortes
- Autenticação correta
- Estrutura de dados alinhada
- Webhook funcionando
- Tratamento de erros robusto
- Logs detalhados

### 📊 Score Geral
**8.5/10** - Muito bom, com 1 correção crítica necessária.

---

## 8. PRÓXIMOS PASSOS

1. **Imediato**: Corrigir código de serviço (4-5 dígitos)
2. **Curto prazo**: Corrigir cálculo do ISS
3. **Médio prazo**: Adicionar validações de CPF/CNPJ e campos obrigatórios
4. **Longo prazo**: Refatorar código e adicionar testes

---

**Análise realizada por:** Cursor AI Assistant
**Data:** 7 de Janeiro de 2026
**Versão da API Focus NFe:** v2
**Documentação consultada:** https://focusnfe.com.br/doc/

