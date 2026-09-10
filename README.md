# PROMPT MESTRE — SAAS DE ROTINA, ESTUDOS E DESENVOLVIMENTO INFANTIL

Você é um engenheiro de software sênior, arquiteto de sistemas, product designer UX/UI e especialista em desenvolvimento de aplicações SaaS.

Sua tarefa é PROJETAR E CONSTRUIR um SaaS completo para famílias, cujo objetivo é ajudar responsáveis a organizar a rotina das crianças e ajudar as crianças a desenvolver hábitos de estudo, responsabilidades, equilíbrio de tempo e autonomia.

IMPORTANTE:

* Não trate este projeto como uma simples lista de tarefas.
* Não transforme o produto em apenas um aplicativo de estudos.
* Não simplifique as funcionalidades descritas abaixo.
* Não invente funcionalidades que alterem o conceito principal.
* Se alguma decisão técnica não estiver especificada, escolha uma solução moderna, segura, escalável e simples de manter.
* Antes de implementar grandes partes do sistema, analise as regras de negócio e mantenha consistência entre banco de dados, backend e frontend.
* O sistema deverá ser preparado para funcionar como SaaS multiusuário.
* O produto possui DOIS ambientes distintos: RESPONSÁVEL e CRIANÇA.
* A experiência da criança deve ser extremamente simples, visual, amigável e gamificada.
* A experiência do responsável deve ser mais completa, analítica e configurável.

==================================================

1. VISÃO GERAL DO PRODUTO
   ==================================================

O produto será uma plataforma para famílias acompanharem:

1. Tempo de estudo
2. Matérias estudadas
3. Conteúdos estudados
4. Pequenas avaliações após o estudo
5. Desempenho acadêmico
6. Tempo de TV
7. Tempo de celular
8. Tempo de jogos
9. Tempo livre
10. Responsabilidades domésticas
11. Hábitos e rotina
12. Pontos e recompensas
13. Metas diárias e semanais
14. Histórico e relatórios
15. Evolução da criança ao longo do tempo

A ideia central é:

ESTUDO → TEMPO REGISTRADO → AVALIAÇÃO → DESEMPENHO → EVOLUÇÃO

E:

RESPONSABILIDADES → CONCLUSÃO → PONTOS → RECOMPENSAS

O responsável poderá visualizar toda a rotina da criança em um único lugar.

==================================================
2. TIPOS DE USUÁRIO
===================

Existem dois tipos principais:

A) RESPONSÁVEL

B) CRIANÇA

O responsável possui controle administrativo sobre a conta da família.

A criança possui acesso limitado e uma interface própria.

Nunca misture as interfaces.

==================================================
3. LOGIN E AUTENTICAÇÃO
=======================

Criar sistema completo de autenticação.

RESPONSÁVEL:

* Cadastro
* Login
* Logout
* Recuperação de senha
* Alteração de senha
* Perfil
* Configurações da conta

CRIANÇA:

A criança deverá possuir um perfil próprio vinculado ao responsável.

A criança NÃO deve possuir acesso às configurações administrativas.

O responsável deverá poder criar um ou mais perfis infantis.

Exemplo:

Família Silva

Responsável:
João Silva

Crianças:

* Ana, 8 anos
* Pedro, 11 anos

Cada criança possui seus próprios:

* estudos
* matérias
* tarefas
* tempo de tela
* pontos
* recompensas
* metas
* histórico
* desempenho

Os dados de uma criança nunca podem aparecer para outra criança, exceto no dashboard autorizado do responsável.

==================================================
4. ONBOARDING DO RESPONSÁVEL
============================

Ao criar uma conta, o responsável deverá passar por um onboarding.

Perguntar:

* Nome do responsável
* Nome da família
* Nome da criança
* Idade da criança
* Avatar da criança
* Objetivos principais

Exemplos de objetivos:

[ ] Melhorar rotina
[ ] Melhorar estudos
[ ] Reduzir tempo de tela
[ ] Criar responsabilidades
[ ] Incentivar leitura
[ ] Melhorar organização
[ ] Criar hábitos

Depois disso, oferecer configuração inicial da rotina.

==================================================
5. PERFIL DA CRIANÇA
====================

Cada criança possui:

* Nome
* Avatar
* Idade
* Data de nascimento opcional
* Cor/tema visual
* Nível
* XP
* Pontos
* Sequência de dias
* Metas
* Estatísticas

A interface infantil deve ser adequada à idade.

Não utilizar dashboards complexos para a criança.

A criança deve entender o aplicativo visualmente.

==================================================
6. DASHBOARD DA CRIANÇA
=======================

A tela inicial deverá mostrar:

"Minha rotina de hoje"

Exemplo:

BOM DIA, ANA! 👋

Hoje você tem:

📚 Estudar Matemática
📝 Fazer tarefa
🧹 Arrumar o quarto
📖 Ler 20 minutos

Depois:

HOJE

📚 Estudos
40 min

🧹 Responsabilidades
3/4 concluídas

⭐ Pontos
120

🔥 Sequência
5 dias

🎁 Próxima recompensa
80 pontos restantes

A criança deverá conseguir iniciar as atividades diretamente pela tela inicial.

==================================================
7. SISTEMA DE ESTUDO
====================

O responsável deverá cadastrar matérias.

Exemplos:

* Matemática
* Português
* Ciências
* História
* Geografia
* Inglês
* etc.

Cada matéria poderá possuir assuntos/conteúdos.

Exemplo:

Matemática

→ Frações
→ Multiplicação
→ Divisão
→ Porcentagem

A criança poderá iniciar uma sessão de estudo.

==================================================
8. CRONÔMETRO DE ESTUDO
=======================

Criar cronômetro real.

Fluxo:

1. Criança escolhe a matéria.
2. Escolhe ou recebe um assunto.
3. Clica em:

"COMEÇAR ESTUDO"

4. Cronômetro inicia.
5. Sistema registra início.
6. Criança pode pausar.
7. Criança pode finalizar.
8. Sistema registra fim.
9. Sistema calcula duração real.
10. Sessão é salva no banco.

Registrar:

* criança
* matéria
* assunto
* início
* fim
* duração
* status
* data
* observações opcionais

Evitar perda de dados caso o navegador seja fechado ou a página seja atualizada.

==================================================
9. SESSÕES DE ESTUDO
====================

Criar modalidades:

ESTUDO RÁPIDO
20 minutos

ESTUDO NORMAL
40 minutos

ESTUDO LONGO
60 minutos

O responsável poderá configurar esses valores.

Não obrigar toda sessão a possuir prova.

==================================================
10. AVALIAÇÃO PÓS-ESTUDO
========================

Esta é uma das funcionalidades CENTRAIS do produto.

Depois de determinada sessão, o sistema poderá apresentar uma pequena avaliação.

Exemplo:

A criança estudou:

Matemática
Frações
20 minutos

Então aparece:

🧠 HORA DO DESAFIO!

"Vamos descobrir quanto você aprendeu."

Criar perguntas objetivas e/ou outros formatos apropriados.

Exemplo:

5 a 10 questões.

Registrar:

* questão
* resposta
* resposta correta
* tempo de resposta
* acerto/erro
* matéria
* assunto
* avaliação relacionada
* nota final

Ao terminar:

🎉 VOCÊ TERMINOU!

8 / 10 acertos

80%

+30 XP

==================================================
11. MOTOR DE APRENDIZADO
========================

O sistema deverá armazenar histórico de desempenho.

Exemplo:

Matemática

Frações:

Semana 1 → 65%
Semana 2 → 72%
Semana 3 → 81%
Semana 4 → 87%

O sistema poderá identificar conteúdos com desempenho baixo.

Exemplo:

"Frações"
67%

E sugerir ao responsável:

"Este conteúdo apresenta desempenho abaixo da média."

Não tomar decisões educacionais críticas automaticamente.

As sugestões devem ser apresentadas como recomendações.

==================================================
12. DASHBOARD ACADÊMICO DO RESPONSÁVEL
======================================

Mostrar:

Tempo estudado

Questões respondidas

Taxa de acerto

Desempenho por matéria

Desempenho por assunto

Evolução semanal

Evolução mensal

Exemplo:

MATEMÁTICA

Tempo:
3h20

Questões:
47

Acertos:
84%

Evolução:
↑ 12%

PORTUGUÊS

Tempo:
2h10

Questões:
31

Acertos:
91%

==================================================
13. TRACKER DE TEMPO
====================

O sistema deverá permitir registrar diferentes categorias de tempo.

Categorias padrão:

📚 Estudo
📺 TV
📱 Celular
🎮 Jogos
🛝 Tempo livre
📖 Leitura
💤 Descanso

O responsável poderá criar categorias personalizadas.

Cada categoria poderá ter:

* nome
* ícone
* limite diário
* limite semanal
* se conta para pontos
* se exige aprovação
* se aparece no dashboard

==================================================
14. TEMPO DE TELA
=================

Importante:

Na primeira versão, o sistema deve REGISTRAR o tempo de tela através dos cronômetros do próprio aplicativo.

Não presumir que o sistema consegue detectar automaticamente o uso real de outros aplicativos do celular ou televisão.

Criar:

"Começar tempo de celular"

"Começar tempo de TV"

"Começar tempo de jogos"

Ao finalizar:

registrar duração.

Arquitetar o sistema de maneira que futuras integrações de controle parental possam ser adicionadas.

==================================================
15. RESPONSABILIDADES DOMÉSTICAS
================================

O responsável pode criar tarefas.

Exemplos:

🛏️ Arrumar a cama

🧸 Guardar brinquedos

🧹 Arrumar o quarto

🐶 Alimentar o cachorro

📚 Guardar material escolar

Cada tarefa poderá possuir:

* título
* descrição
* frequência
* horário opcional
* pontos
* XP
* necessidade de aprovação
* prazo
* recorrência

==================================================
16. FLUXO DE TAREFA
===================

Exemplo:

Responsável cria:

"Arrumar o quarto"

+10 pontos

A criança vê:

🧹 Arrumar o quarto

[CONCLUIR]

Criança clica.

Status:

"AGUARDANDO APROVAÇÃO"

Responsável recebe:

"Ana concluiu Arrumar o quarto."

Responsável:

[APROVAR]

Depois:

✅ Concluído

+10 pontos

O responsável poderá configurar algumas tarefas para não exigir aprovação.

==================================================
17. SISTEMA DE PONTOS
=====================

Criar sistema de pontos separado de XP.

PONTOS:

Utilizados para recompensas.

XP:

Utilizado para progressão/gamificação.

Exemplo:

20 minutos de estudo
+20 XP
+10 pontos

Prova ≥80%
+30 XP
+10 pontos

Tarefa doméstica
+10 XP
+10 pontos

Meta diária concluída
+50 XP
+20 pontos

Os valores devem ser configuráveis pelo responsável.

==================================================
18. NÍVEIS
==========

Criar níveis.

Exemplo:

Nível 1
Iniciante

Nível 2
Explorador

Nível 3
Aprendiz

Nível 4
Dedicado

Nível 5
Mestre

A progressão deve utilizar XP.

Mostrar barra:

NÍVEL 4

████████████░░░

820 / 1000 XP

==================================================
19. RECOMPENSAS
===============

O responsável poderá cadastrar recompensas.

Exemplos:

🎮 30 minutos de videogame
100 pontos

📺 Escolher o filme
150 pontos

🍦 Sorvete
200 pontos

🎨 Escolher uma atividade
250 pontos

🎁 Recompensa personalizada
500 pontos

A criança poderá solicitar/resgatar uma recompensa.

Fluxo:

Criança:

"Resgatar"

Sistema:

"Você quer trocar 100 pontos por 30 minutos de videogame?"

[CONFIRMAR]

O responsável poderá exigir aprovação.

==================================================
20. METAS
=========

Criar metas:

DIÁRIAS

SEMANAIS

Exemplos:

Estudar 60 minutos.

Ler 20 minutos.

Concluir 4 responsabilidades.

Limitar celular a 60 minutos.

Limitar TV a 90 minutos.

Criar progresso visual.

Exemplo:

META DE ESTUDO

45 / 60 min

██████████████░░

75%

==================================================
21. STREAK / SEQUÊNCIA
======================

Criar sistema de sequência.

Exemplo:

🔥 7 dias seguidos

Contabilizar sequência conforme regras configuradas.

Não criar punições severas por quebra de sequência.

==================================================
22. DASHBOARD DO RESPONSÁVEL
============================

O dashboard do responsável é uma das principais telas.

Mostrar:

CRIANÇA

Ana

RESUMO DE HOJE

📚 Estudo
1h20

📺 TV
45min

📱 Celular
30min

🎮 Jogos
40min

🛝 Tempo livre
1h10

🧹 Responsabilidades
4/5

⭐ Pontos
320

🔥 Sequência
6 dias

==================================================
23. RELATÓRIO SEMANAL
=====================

Criar relatório semanal.

Exemplo:

SEMANA

Estudo
7h35

TV
4h10

Celular
3h20

Jogos
2h45

Tempo livre
5h30

Responsabilidades
32/35

Desempenho acadêmico
84%

Mostrar gráficos simples e fáceis de interpretar.

==================================================
24. COMPARAÇÃO DE TEMPO
=======================

Mostrar visualmente:

ESTUDO
7h35

LAZER
8h15

TELA
7h10

RESPONSABILIDADES
3h20

Permitir visualizar:

Hoje
Esta semana
Este mês

==================================================
25. CONFIGURAÇÕES DO RESPONSÁVEL
================================

Criar painel administrativo.

Seções:

Perfil

Família

Crianças

Rotina

Matérias

Responsabilidades

Categorias de tempo

Metas

Pontuação

XP

Recompensas

Notificações

Configurações da conta

==================================================
26. ROTINA
==========

O responsável deverá conseguir montar uma rotina.

Exemplo:

SEGUNDA

07:00
Acordar

08:00
Escola

14:00
Almoço

15:00
Estudo

16:00
Tempo livre

17:00
Responsabilidade

18:00
Celular

19:00
Jantar

20:00
Leitura

21:00
Dormir

A rotina deverá ser flexível.

Não assumir que todas as crianças possuem os mesmos horários.

==================================================
27. GAMIFICAÇÃO
===============

A gamificação deve ser positiva.

Utilizar:

* XP
* pontos
* níveis
* medalhas
* streaks
* desafios
* progresso
* recompensas

Evitar:

* punições agressivas
* linguagem negativa
* pressão excessiva
* comparação entre crianças

A criança deve sentir:

"Estou evoluindo."

e não:

"Estou sendo fiscalizado."

==================================================
28. MEDALHAS / CONQUISTAS
=========================

Criar achievements.

Exemplos:

🏆 Primeiro estudo

📚 5 horas estudadas

🔥 7 dias seguidos

🧠 100 questões respondidas

⭐ 90% de aproveitamento

🧹 20 tarefas concluídas

🎯 Primeira meta semanal

==================================================
29. NOTIFICAÇÕES
================

Criar arquitetura para notificações.

Exemplos:

Responsável:

"Ana concluiu a tarefa Arrumar o quarto."

"Ana estudou 40 minutos hoje."

"Ana teve 90% de aproveitamento na avaliação."

Criança:

"Hora de estudar Matemática!"

"Você está a 20 pontos da próxima recompensa."

As notificações devem ser configuráveis.

==================================================
30. BANCO DE DADOS
==================

Projetar banco de dados relacional adequado.

Entidades esperadas:

Users

Families

Children

Subjects

Topics

StudySessions

Assessments

Questions

Answers

TimeSessions

TimeCategories

Chores

ChoreCompletions

Goals

Rewards

RewardRedemptions

PointsTransactions

XPTransactions

Achievements

ChildAchievements

Notifications

Schedules

Settings

Criar relacionamentos corretamente.

Toda informação deverá possuir associação correta com:

Family
Responsible
Child

Implementar isolamento de dados entre famílias.

==================================================
31. SEGURANÇA
=============

Este produto envolve crianças.

Priorizar segurança e privacidade.

Implementar:

* autenticação segura
* autorização por função
* isolamento de dados
* validação de entrada
* proteção contra acesso indevido
* proteção de APIs
* sessões seguras
* controle de permissões
* logs de ações administrativas

Não coletar informações desnecessárias sobre crianças.

Não expor dados infantis publicamente.

==================================================
32. PRIVACIDADE
===============

Projetar pensando em conformidade com legislação aplicável.

Como o produto pode ser utilizado por crianças, considerar especialmente:

* LGPD
* consentimento do responsável
* minimização de dados
* exclusão de dados
* transparência
* controle parental

Não implementar publicidade direcionada para crianças.

==================================================
33. DESIGN
==========

CRIAR DOIS DESIGN SYSTEMS RELACIONADOS.

RESPONSÁVEL:

Visual:

* moderno
* profissional
* limpo
* dashboard SaaS
* gráficos
* cards
* filtros
* tabelas quando necessárias

CRIANÇA:

Visual:

* colorido
* amigável
* simples
* grandes botões
* ícones
* personagens/avatares
* animações sutis
* feedback visual

Evitar interface infantilizada demais para crianças maiores.

O design deve ser adaptável por faixa etária.

==================================================
34. RESPONSIVIDADE
==================

O produto deve funcionar em:

Desktop

Tablet

Celular

A interface infantil deve priorizar celular/tablet.

A interface do responsável deve funcionar muito bem em desktop e celular.

==================================================
35. ARQUITETURA
===============

Escolha uma arquitetura moderna.

Preferência:

Frontend:
React / Next.js

Backend:
API moderna e organizada

Banco:
PostgreSQL

Autenticação:
solução segura e consolidada

O projeto deve ser modular.

Separar:

UI

componentes

hooks

serviços

API

regras de negócio

database

autenticação

validação

tipos

Não criar um monolito desorganizado.

==================================================
36. REGRAS IMPORTANTES
======================

REGRA 1

Uma criança só pode visualizar seus próprios dados.

REGRA 2

O responsável pode visualizar os dados das crianças vinculadas à sua família.

REGRA 3

A criança não pode alterar:

* pontos
* XP
* recompensas
* metas
* configurações
* limites
* tarefas criadas pelo responsável

REGRA 4

O responsável pode corrigir registros quando necessário.

REGRA 5

Todas as alterações importantes devem ser registradas.

REGRA 6

Cronômetros devem ser resistentes a refresh/fechamento acidental.

REGRA 7

Nunca confiar apenas no frontend para segurança.

==================================================
37. EXPERIÊNCIA PRINCIPAL DA CRIANÇA
====================================

O fluxo mais importante deve ser:

LOGIN

↓

MINHA ROTINA

↓

ESCOLHER ATIVIDADE

↓

EXECUTAR

↓

CONCLUIR

↓

GANHAR XP/PONTOS

↓

VER PROGRESSO

↓

DESBLOQUEAR RECOMPENSAS

Para estudos:

LOGIN

↓

ESTUDAR

↓

CRONÔMETRO

↓

FINALIZAR

↓

AVALIAÇÃO

↓

RESULTADO

↓

XP/PONTOS

↓

EVOLUÇÃO

==================================================
38. EXPERIÊNCIA PRINCIPAL DO RESPONSÁVEL
========================================

LOGIN

↓

DASHBOARD

↓

VER CRIANÇA

↓

VER ROTINA

↓

CONFIGURAR

↓

ACOMPANHAR

↓

VER RELATÓRIOS

↓

AJUSTAR METAS

↓

CRIAR RECOMPENSAS

O responsável não precisa ficar constantemente monitorando a criança.

O sistema deve fazer o máximo possível automaticamente.

==================================================
39. FUTURO — IA
===============

Preparar arquitetura para futura integração de IA.

Possibilidades futuras:

* gerar questões
* adaptar dificuldade
* identificar conteúdos com dificuldade
* sugerir revisão
* gerar planos de estudo
* resumir desempenho semanal
* sugerir rotina
* criar desafios personalizados

IMPORTANTE:

Não implementar IA de forma improvisada na primeira versão.

Criar interfaces/serviços que permitam adicionar isso posteriormente.

==================================================
40. FUTURO — CONTROLE PARENTAL
==============================

Arquitetar para futuras integrações com:

* Android
* iOS
* Windows
* APIs de controle parental
* tempo real de tela
* bloqueios
* limites de aplicativos

Na primeira versão, NÃO fingir que o sistema consegue medir automaticamente o tempo utilizado em outros aplicativos.

Utilizar apenas cronômetros internos.

==================================================
41. MONETIZAÇÃO
===============

Preparar arquitetura SaaS.

Possíveis planos:

FREE

* 1 criança
* funcionalidades básicas

FAMILY

* múltiplas crianças
* relatórios
* metas
* recompensas

PREMIUM

* IA
* relatórios avançados
* automações
* recursos adicionais

Não implementar pagamentos antes de a arquitetura principal estar funcional.

==================================================
42. MVP
=======

A primeira versão funcional deve priorizar:

1. Cadastro/login responsável
2. Criação de criança
3. Login/perfil infantil
4. Dashboard infantil
5. Dashboard responsável
6. Cadastro de matérias
7. Cronômetro de estudo
8. Registro de estudo
9. Avaliação pós-estudo
10. Questões e respostas
11. Responsabilidades
12. Conclusão de tarefas
13. Aprovação
14. Cronômetros de TV/celular/jogos
15. Pontos
16. XP
17. Recompensas
18. Metas
19. Histórico
20. Relatório semanal

==================================================
43. O QUE NÃO FAZER NO MVP
==========================

Não implementar inicialmente:

* rede social
* chat entre crianças
* ranking público
* publicidade
* marketplace
* funcionalidades complexas de escola
* controle parental de sistema operacional
* monitoramento invasivo
* funcionalidades que exijam hardware externo

Concentrar-se no núcleo do produto.

==================================================
44. METODOLOGIA DE DESENVOLVIMENTO
==================================

NÃO tente construir tudo de uma vez.

Primeiro:

FASE 1
Analise este documento.

Apresente:

* arquitetura proposta
* stack
* estrutura de pastas
* modelo de dados
* entidades
* relacionamentos
* autenticação
* permissões
* fluxos principais

Não escreva código ainda.

Depois:

FASE 2

Criar banco de dados e autenticação.

Depois:

FASE 3

Criar layout e design system.

Depois:

FASE 4

Criar dashboard do responsável.

Depois:

FASE 5

Criar experiência infantil.

Depois:

FASE 6

Criar sistema de estudos.

Depois:

FASE 7

Criar avaliações.

Depois:

FASE 8

Criar tarefas/responsabilidades.

Depois:

FASE 9

Criar tracker de tempo.

Depois:

FASE 10

Criar pontos, XP e recompensas.

Depois:

FASE 11

Criar relatórios.

Depois:

FASE 12

Testes, segurança, validação e refinamento.

==================================================
45. TESTES
==========

Criar testes para:

* autenticação
* autorização
* isolamento entre famílias
* isolamento entre crianças
* cronômetro
* sessões de estudo
* avaliações
* cálculo de notas
* pontos
* XP
* recompensas
* tarefas
* metas
* relatórios

Testar principalmente cenários de manipulação indevida pelo usuário infantil.

==================================================
46. PRINCÍPIO FUNDAMENTAL DO PRODUTO
====================================

O produto não deve parecer um sistema de vigilância.

A proposta é:

AJUDAR A CRIANÇA A DESENVOLVER AUTONOMIA.

==================================================
47. ANDAMENTO ATUAL
===================

Implementado nesta etapa:

* Protótipo navegável do dashboard do responsável em `index.html`.
* Design responsivo em `styles.css`, com linguagem visual própria para o ambiente administrativo.
* Seleção entre Ana e Pedro, rotina diária, metas, progresso acadêmico e próxima recompensa.
* Interações básicas em `app.js`: seleção de criança, início de atividade, navegação e mensagens de feedback.

Ainda não implementado:

* Credenciais reais do projeto Supabase no ambiente local.
* Persistência completa de todas as ações demonstrativas das telas.
* Testes automatizados contra um projeto Supabase de homologação.

Próxima sequência recomendada:

1. Disponibilizar Node.js/npm e migrar o protótipo para React/TypeScript.
2. Criar o design system compartilhado e a experiência infantil separada.
3. Modelar autenticação, família, responsável e criança.
4. Implementar o núcleo do MVP: rotina, estudo com cronômetro, tarefas, pontos/XP e recompensas.
5. Adicionar persistência, autorização por função e testes de isolamento.

Atualização da navegação:

* As telas de Visão geral, Rotina, Estudos, Responsabilidades, Desempenho, Recompensas e Configurações já possuem views navegáveis no protótipo.
* A navegação utiliza hash da URL, preserva voltar/avançar do navegador e atualiza o título da página.
* As ações demonstrativas exibem feedback visual e estão prontas para serem conectadas aos serviços do backend.

Integração Supabase:

* `supabase-schema.sql` contém o modelo inicial do banco e políticas RLS para separar famílias e perfis.
* `supabase-client.js` encapsula login, criação de conta, criação da família e criação da primeira criança.
* `supabase-config.js` deve receber a URL e a chave anon pública do projeto Supabase.
* O SDK é carregado por CDN, portanto esta versão continua executável sem npm/Node.js.

Para ativar:

1. Crie um projeto no Supabase.
2. Execute `supabase-schema.sql` no SQL Editor.
3. Copie Project URL e anon public key para `supabase-config.js`.
4. Abra a rota `#login` e crie uma família pelo onboarding.

As credenciais reais não foram incluídas no repositório.

Isolamento entre famílias:

* Execute `supabase-provision-family.sql` para publicar a RPC de criação da família.
* Execute `supabase-tenant-isolation.sql` para aplicar RLS e as validações de relacionamento entre família e criança.
* A aplicação carrega a família pelo vínculo autenticado e não usa dados de demonstração para o dashboard.
* Não desative RLS no Supabase. A segurança não deve depender de filtros do frontend.

Observação: `supabase-schema.sql` está vazio nesta etapa; use os scripts de migração acima sobre as tabelas já criadas no projeto Supabase.

O responsável configura.

A criança executa.

O sistema acompanha.

O sistema transforma esforço em progresso.

O sistema mostra aprendizado.

O sistema incentiva consistência.

O responsável consegue enxergar a evolução sem precisar controlar manualmente cada minuto.

==================================================
47. RESULTADO ESPERADO
======================

Ao final do desenvolvimento, quero ter uma aplicação SaaS funcional onde:

Um responsável cria sua conta.

↓

Cria o perfil de uma criança.

↓

Configura matérias.

↓

Configura rotina.

↓

Cria responsabilidades.

↓

Define metas.

↓

Cria recompensas.

↓

A criança entra em seu próprio ambiente.

↓

Visualiza sua rotina.

↓

Inicia um estudo.

↓

O cronômetro registra o tempo.

↓

Ao terminar, pode realizar uma pequena avaliação.

↓

O sistema registra desempenho.

↓

A criança ganha XP/pontos.

↓

A criança conclui responsabilidades.

↓

Recebe pontos.

↓

Pode trocar pontos por recompensas.

↓

O responsável acompanha tudo através do dashboard.

↓

Ao final da semana, o sistema apresenta:

TEMPO DE ESTUDO

TEMPO DE TELA

TEMPO LIVRE

RESPONSABILIDADES

PONTOS

XP

METAS

DESEMPENHO ESCOLAR

EVOLUÇÃO

==================================================
48. INSTRUÇÃO FINAL AO TRAE
===========================

Você deve agir como responsável técnico pelo projeto.

Não faça suposições que alterem o produto.

Quando houver uma decisão técnica não especificada, escolha a solução mais adequada e explique brevemente a decisão.

Priorize:

1. Funcionalidade
2. Segurança
3. UX
4. Arquitetura limpa
5. Escalabilidade
6. Manutenibilidade
7. Performance

Não gerar código descartável apenas para "mostrar uma demo".

Construir uma base real de produto SaaS.

Antes de cada grande etapa, verificar se a implementação está coerente com o modelo de dados e com as regras de negócio.

Quando terminar uma etapa:

* explique o que foi implementado
* liste os arquivos modificados
* informe como testar
* informe eventuais limitações
* informe o próximo passo recomendado

NÃO pule etapas.

COMECE AGORA PELA FASE 1.

Não implemente código ainda.

Primeiro apresente a arquitetura completa proposta para validação.
