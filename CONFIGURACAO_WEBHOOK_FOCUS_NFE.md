# Configuração do Webhook Focus NFe

## O que é o Webhook?

O webhook é uma URL que a Focus NFe chama automaticamente quando o status de uma nota fiscal muda (autorizada, rejeitada, erro, etc.).

---

## ✅ Status Atual

O código do webhook **JÁ ESTÁ IMPLEMENTADO** e funcionando corretamente em:
- `supabase/functions/focus-nfe-webhook/index.ts`

**O que o webhook faz:**
- Recebe notificações da Focus NFe
- Atualiza automaticamente o status da nota no banco de dados
- Salva erros, número da nota, código de verificação, URLs do PDF/XML
- Trata múltiplos formatos de erro

---

## 🔧 Como Configurar o Webhook na Focus NFe

### Passo 1: Obter a URL do Webhook

A URL do webhook do seu projeto é:

```
https://tioyfvdcfkicghogddxb.supabase.co/functions/v1/focus-nfe-webhook
```

### Passo 2: Configurar na Focus NFe

1. **Acesse:** https://homologacao.focusnfe.com.br (ou https://api.focusnfe.com.br para produção)

2. **Login:** Entre com suas credenciais

3. **Navegue para:** Configurações > Webhooks (ou Gatilhos)

4. **Criar Novo Webhook:**
   - **URL:** `https://tioyfvdcfkicghogddxb.supabase.co/functions/v1/focus-nfe-webhook`
   - **Eventos:** Selecione todos relacionados a NFSe:
     - ✅ `nfse.autorizado`
     - ✅ `nfse.erro_autorizacao`
     - ✅ `nfse.cancelado`
     - ✅ `nfse.processando_autorizacao`
   - **Método:** POST
   - **Content-Type:** application/json

5. **Salvar** a configuração

### Passo 3: Testar o Webhook

1. Após configurar, a Focus NFe tem uma opção **"Testar Webhook"**
2. Clique para enviar um webhook de teste
3. Verifique os logs no Supabase:
   - Acesse: https://app.supabase.com
   - Vá em: Edge Functions > focus-nfe-webhook > Logs
   - Procure por: `🔔 Webhook recebido da Focus NFe`

---

## 📋 Como Verificar se o Webhook Está Configurado

### Via API da Focus NFe

Você pode consultar os webhooks configurados via API:

```bash
curl -u SEU_TOKEN: \
  https://homologacao.focusnfe.com.br/v2/hooks
```

**Resposta esperada:**
```json
[
  {
    "id": "123456",
    "url": "https://tioyfvdcfkicghogddxb.supabase.co/functions/v1/focus-nfe-webhook",
    "events": ["nfse.autorizado", "nfse.erro_autorizacao", ...],
    "active": true
  }
]
```

### Criar Webhook via API

Se preferir criar via API:

```bash
curl -u SEU_TOKEN: \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://tioyfvdcfkicghogddxb.supabase.co/functions/v1/focus-nfe-webhook",
    "events": ["nfse.autorizado", "nfse.erro_autorizacao", "nfse.cancelado"]
  }' \
  https://homologacao.focusnfe.com.br/v2/hooks
```

---

## 🔍 Como Verificar se o Webhook Está Funcionando

### 1. Verificar Logs do Webhook no Supabase

1. Acesse: https://app.supabase.com
2. Selecione seu projeto
3. Vá em: **Edge Functions** > `focus-nfe-webhook` > **Logs**
4. Procure por mensagens como:
   ```
   🔔 Webhook recebido da Focus NFe
   ✅ OS atualizada com sucesso
   ```

### 2. Verificar Status da Ordem de Serviço

No banco de dados, verifique se os campos estão sendo atualizados:
- `invoice_status` (deve mudar de "processando" para "autorizado" ou "erro_autorizacao")
- `invoice_error` (deve conter a mensagem de erro, se houver)
- `invoice_error_code` (deve conter o código do erro, se houver)
- `invoice_number` (deve conter o número da nota, se autorizada)
- `invoice_verification_code` (código de verificação)
- `invoice_pdf_url` (URL do PDF)
- `invoice_xml_url` (URL do XML)

---

## 🚨 Solução de Problemas

### Problema 1: Webhook não está recebendo notificações

**Possíveis causas:**
1. Webhook não configurado na Focus NFe
2. URL incorreta
3. Eventos não selecionados
4. Edge Function não foi deployada

**Solução:**
1. Verificar se o webhook está configurado (via painel ou API)
2. Verificar se a URL está correta
3. Fazer deploy da Edge Function:
   ```bash
   supabase functions deploy focus-nfe-webhook
   ```

### Problema 2: Webhook retorna erro 500

**Possíveis causas:**
1. Variáveis de ambiente não configuradas no Supabase
2. Erro no código do webhook

**Solução:**
1. Verificar variáveis de ambiente:
   - Acesse: Supabase > Settings > Edge Functions > Secrets
   - Verificar se `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` estão configuradas
2. Verificar logs do webhook para detalhes do erro

### Problema 3: Banco de dados não está sendo atualizado

**Possíveis causas:**
1. Campo `invoice_reference` não corresponde ao `ref` enviado pela Focus NFe
2. Permissões de banco de dados insuficientes

**Solução:**
1. Verificar logs do webhook para ver qual `ref` está sendo recebido
2. Comparar com o campo `invoice_reference` da ordem de serviço no banco
3. Verificar se a Service Role Key tem permissões para atualizar a tabela `service_orders`

---

## 📊 Fluxo Completo

### Emissão de Nota

1. **Sistema envia** requisição para `focus-nfe-emit-nfe-service`
2. **Edge Function valida** dados e envia para Focus NFe
3. **Focus NFe aceita** a nota e retorna status 200
4. **Sistema salva** `invoice_status = "processando_autorizacao"`
5. **Edge Function aguarda 3 segundos** e consulta o status
6. **Se houver erro imediato**, retorna erro para o usuário
7. **Se não houver erro**, retorna sucesso

### Webhook (Assíncrono)

1. **Focus NFe processa** a nota com a prefeitura
2. **Status muda** (autorizado, erro, etc.)
3. **Focus NFe chama** o webhook com os novos dados
4. **Webhook atualiza** o banco de dados automaticamente
5. **Usuário vê** o status atualizado na tela (refresh)

---

## 🎯 Melhorias Implementadas

### 1. Notificação Imediata de Erros ✅

Agora o sistema:
- Aguarda 3 segundos após enviar
- Consulta o status na Focus NFe
- Se houver erro, retorna **imediatamente** para o usuário
- Se não houver erro, aguarda o webhook atualizar

### 2. Múltiplos Formatos de Erro ✅

O webhook trata erros em vários formatos:
- `erros` (array direto)
- `data.erros`
- `mensagem_sefaz`
- `mensagem`
- `metadata.response.data.erros`

### 3. Logs Detalhados ✅

Todos os logs incluem:
- 📦 Corpo bruto recebido
- 📋 Headers
- 📄 Dados parseados
- ✅ Confirmação de salvamento

---

## 📝 Checklist de Configuração

- [ ] Webhook implementado no código ✅ (já feito)
- [ ] Edge Function deployada no Supabase
- [ ] Webhook configurado na Focus NFe (Homologação)
- [ ] Webhook configurado na Focus NFe (Produção)
- [ ] Teste realizado
- [ ] Logs verificados no Supabase
- [ ] Banco de dados atualizando corretamente

---

## 🆘 Suporte

Se precisar de ajuda:
1. Verifique os logs no Supabase
2. Verifique os logs na Focus NFe
3. Compare o `ref` entre o sistema e a Focus NFe
4. Verifique se o webhook está ativo na Focus NFe

---

**Última atualização:** 7 de Janeiro de 2026

