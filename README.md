# 🏛️ Monitor Proposições BA — ALBA

Monitora automaticamente a API de Dados Abertos da Assembleia Legislativa da Bahia e envia email quando há proposições novas. Roda **4x por dia** via GitHub Actions (8h, 12h, 17h e 21h, horário de Brasília).

---

## Como funciona

1. O GitHub Actions roda o script nos horários configurados
2. O script chama a API pública da ALBA (`albalegis.nopapercloud.com.br/api/publico`)
3. Compara as proposições recebidas com as já registradas no `estado.json`
4. Se há proposições novas → envia email com a lista organizada por tipo
5. Salva o estado atualizado no repositório

---

## Estrutura do repositório

```
monitor-proposicoes-ba/
├── monitor.js                      # Script principal
├── package.json                    # Dependências (só nodemailer)
├── estado.json                     # Estado salvo automaticamente pelo workflow
├── README.md                       # Este arquivo
└── .github/
    └── workflows/
        └── monitor.yml             # Workflow do GitHub Actions
```

---

## Setup — Passo a Passo

### PARTE 1 — Preparar o Gmail

**1.1** Acesse [myaccount.google.com/security](https://myaccount.google.com/security)

**1.2** Certifique-se de que a **Verificação em duas etapas** está ativa.

**1.3** Procure por **"Senhas de app"** e clique.

**1.4** Digite um nome qualquer (ex: `monitor-alba`) e clique em **Criar**.

**1.5** Copie a senha de **16 letras** gerada — ela só aparece uma vez.

> Se já usa o mesmo Gmail para outro monitor, pode reutilizar a mesma senha de app.

---

### PARTE 2 — Criar o repositório no GitHub

**2.1** Acesse [github.com](https://github.com) e clique em **+ → New repository**

**2.2** Preencha:
- **Repository name:** `monitor-proposicoes-ba`
- **Visibility:** Private

**2.3** Clique em **Create repository**

---

### PARTE 3 — Fazer upload dos arquivos

**3.1** Na página do repositório, clique em **"uploading an existing file"**

**3.2** Faça upload de:
```
monitor.js
package.json
README.md
```
Clique em **Commit changes**.

**3.3** O `monitor.yml` precisa estar numa pasta específica. Clique em **Add file → Create new file**, digite o nome:
```
.github/workflows/monitor.yml
```
Abra o arquivo `monitor.yml`, copie todo o conteúdo e cole. Clique em **Commit changes**.

---

### PARTE 4 — Configurar os Secrets

**4.1** No repositório: **Settings → Secrets and variables → Actions**

**4.2** Clique em **New repository secret** e crie os 3 secrets:

| Name | Valor |
|------|-------|
| `EMAIL_REMETENTE` | seu Gmail (ex: seuemail@gmail.com) |
| `EMAIL_SENHA` | a senha de 16 letras do App Password (sem espaços) |
| `EMAIL_DESTINO` | email onde quer receber os alertas |

---

### PARTE 5 — Testar

**5.1** Vá em **Actions → Monitor Proposições BA → Run workflow → Run workflow**

**5.2** Aguarde ~30 segundos (são ~6 páginas na API). Verde = funcionou.

**5.3** O **primeiro run** envia email com todas as proposições do ano atual e salva o estado. A partir do segundo run, só envia se houver proposições novas.

---

## Email recebido

O email chega organizado por tipo (sigla), com número em ordem decrescente:

```
🏛️ ALBA — 3 nova(s) proposição(ões)

MOC — 2 proposição(ões)
  29295/2026 | Pedro Paulo Tavares... | 01/04/2026 | MOÇÃO DE CONGRATULAÇÕES...
  29294/2026 | Pedro Paulo Tavares... | 01/04/2026 | MOÇÃO DE CONGRATULAÇÕES...

PL — 1 proposição(ões)
  26209/2026 | PODER EXECUTIVO        | 01/04/2026 | Altera a Lei nº 10.963...
```

Os números das proposições são links clicáveis que abrem o PDF diretamente.

---

## API utilizada

```
URL Base:  https://albalegis.nopapercloud.com.br/api/publico
Endpoint:  GET /proposicao/?pg=1&qtd=100&ano=2026
Docs:      https://albalegis.nopapercloud.com.br/dados-abertos.aspx
```

API pública e documentada, sem autenticação.

**Campos mapeados:**

| Campo no email | Campo da API |
|----------------|-------------|
| ID interno     | `p.id` |
| Tipo           | `p.sigla` |
| Número         | `p.numero` |
| Autor          | `p.AutorRequerenteDados.nomeRazao` |
| Data           | `p.data` (só a parte da data) |
| Assunto        | `p.assunto` |
| Link PDF       | `p.arquivo` |

---

## Horários de execução

| Horário BRT | Cron UTC |
|-------------|----------|
| 08:00       | 0 11 * * * |
| 12:00       | 0 15 * * * |
| 17:00       | 0 20 * * * |
| 21:00       | 0 0 * * *  |

---

## Resetar o estado

Para forçar o reenvio de todas as proposições (útil para testar):

1. No repositório, clique em `estado.json` → lápis
2. Substitua o conteúdo por:
```json
{"proposicoes_vistas":[],"ultima_execucao":""}
```
3. Commit → rode o workflow manualmente

---

## Problemas comuns

**Não aparece "Senhas de app" no Google**
→ Ative a verificação em duas etapas primeiro.

**Erro "Authentication failed" no log**
→ Verifique se `EMAIL_SENHA` foi colado sem espaços.

**Workflow não aparece em Actions**
→ Confirme que o arquivo está em `.github/workflows/monitor.yml`.

**Rodou mas não veio email**
→ Verifique o spam. Se não estiver lá, abra o log do run e procure por `❌` ou `⚠️`.

**Log mostra "0 proposições encontradas"**
→ Pode ser instabilidade na API da ALBA. Tente acessar diretamente no browser:
`https://albalegis.nopapercloud.com.br/api/publico/proposicao/?pg=1&qtd=1&ano=2026`
