# Integracao OpenAI para provas

## Arquitetura

O frontend chama apenas a Edge Function `generate-exam`. A chave nunca fica no frontend, em `app.js` ou em arquivos publicos.

Fluxo:

1. O responsavel seleciona materia, temas/dias, data, quantidade e dificuldade.
2. `generate-exam` valida autenticacao, familia, crianca, materia, limites e temas.
3. A funcao chama a OpenAI Responses API com JSON Schema estrito.
4. O frontend exibe a previa e permite editar, excluir ou regenerar questoes.
5. Ao aprovar, o frontend chama `approve_exam_with_questions`.
6. O RPC cria `exams` e `exam_questions` na mesma transacao e usa `creation_key` para idempotencia.

## Configuracao da chave

Na raiz do projeto Supabase, configure o segredo:

```bash
supabase secrets set OPENAI_API_KEY=chave-da-openai
supabase secrets set OPENAI_MODEL=gpt-4o-mini
```

Nunca coloque a chave em `supabase-config.js`, `app.js`, HTML, CSS ou no repositorio.

## Desenvolvimento local

Requisitos: Supabase CLI, Docker e Deno.

```bash
supabase start
supabase db reset
supabase functions serve generate-exam --env-file .env.local
```

O arquivo `.env.local` deve ser local e ignorado pelo Git:

```env
OPENAI_API_KEY=chave-da-openai
OPENAI_MODEL=gpt-4o-mini
```

Execute as migrations SQL do projeto, especialmente `supabase-exams.sql`.

## Deploy

```bash
supabase link --project-ref SEU_PROJECT_REF
supabase db push
supabase secrets set OPENAI_API_KEY=chave-da-openai OPENAI_MODEL=gpt-4o-mini
supabase functions deploy generate-exam
```

## Testes

```bash
den o test --allow-read supabase/functions/generate-exam/validation_test.ts
```

Os testes cobrem payload valido, IDs invalidos, quantidades invalidas, temas fora da lista, pontos invalidos e resposta valida da IA. Os cenarios de autenticacao, RLS, falha da OpenAI, timeout, aprovacao transacional e isolamento entre familias devem ser executados contra um projeto Supabase local ou de staging, usando tokens de teste e uma chave OpenAI de teste.

## Chamada pelo frontend

O frontend usa `supabase.functions.invoke('generate-exam', { body })`. O token da sessao e enviado automaticamente pelo cliente Supabase. A aprovacao usa `supabase.rpc('approve_exam_with_questions', payload)` e nao insere diretamente em duas tabelas separadas.
