# MemoriaFlash Web

Site web complementar ao aplicativo MemoriaFlash, com foco em **estudar pelo computador** usando os baralhos e cards sincronizados do Firebase.

Branch: `main`

## Funcionamento

O site é um **SPA de estudo** com login obrigatório:

1. **Tela de login** (React em `src/main.jsx`): landing com botão **Entrar com Google** — sem conteúdo pessoal. O acesso à área de estudos exige autenticação.
2. **Área privada**: liberada após login com Google, com as abas **Início**, **Biblioteca**, **Progresso** e **Ajuda**.

A **criação e geração de baralhos e cards acontece no aplicativo mobile**; o site consome os conteúdos já sincronizados.

## Stack

- React 19
- Vite
- Firebase SDK (Auth + Firestore)
- Firebase Hosting
- GitHub Actions (CI — valida o build em `main`)

## Rodar localmente

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## CI — GitHub Actions

O workflow `.github/workflows/build.yml` roda `npm ci && npm run build` a cada **push ou pull request** para a branch `main`. Ele valida que o site continua compilando antes do deploy.

## Deploy — Firebase Hosting

O site está publicado no **Firebase Hosting** (Google Cloud):

- **URL:** https://flashcardsia-a2f43.web.app
- **Console:** https://console.firebase.google.com/project/flashcardsia-a2f43/overview
- **Projeto:** `flashcardsia-a2f43`

### Publicar uma nova versão

```bash
npm run build
firebase deploy --only hosting
```

> Requer o [Firebase CLI](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`) e login: `firebase login`.

O `firebase.json` aponta para a pasta `dist` com rewrites para SPA (toda rota cai no `index.html`).

### Checklist pós-deploy

1. **Domínio autorizado**: adicione `flashcardsia-a2f43.web.app` (e qualquer domínio customizado) em Firebase Console → Authentication → Settings → **Authorized domains**.
2. **Regras do Firestore**: revise as regras para permitir que usuários autenticados leiam seus decks (coleção `decks`) e criem documentos em `supportRequests`.

## Estrutura do projeto

```text
index.html                  # carrega o app React (body já inicia em modo app)
library.css                 # estilos da biblioteca de baralhos
.github/
└── workflows/
    └── build.yml           # CI: npm ci + npm run build em pushes/PRs para main
public/
├── help.css / help.js      # ajuda (legado — o fluxo atual usa HelpPage + Firestore)
├── login.css / login.js    # orientação do fluxo de login Google
├── progress.css            # estilos da tela de progresso
├── study-first.css         # estilos de estudo (legado)
└── robots.txt              # indexação (bloqueia /src/ e /node_modules/)
src/
├── components/
│   ├── HelpPage.jsx        # página de Ajuda e feedback (envia para o Firestore)
│   └── StudySession.jsx    # sessão de estudo imersiva (SRS + feedback)
├── lib/
│   └── firebase.js         # inicialização do Firebase (Auth + Firestore)
├── services/
│   ├── decks.js            # sincronização de baralhos do usuário
│   ├── feedback.js         # feedback de cards
│   ├── progress.js         # progresso/revisão de cards
│   ├── support.js          # envio de solicitações de suporte (supportRequests)
│   ├── auth.js             # autenticação (legado — centralizada no main.jsx)
│   ├── content.js          # leitura de conteúdo do schema oficial (legado)
│   └── generation.js       # geração por IA (legado, não usado)
├── main.jsx                # app (login Google, home, biblioteca, estudo, progresso, ajuda)
├── help.css                # estilos da página de Ajuda
├── styles.css              # estilos gerais
├── study-ui.css            # estilos da nova interface de estudo
└── study.css               # estilos da sessão de estudo
```

> A área privada é renderizada de forma **monolítica** em `src/main.jsx`. Apenas `decks.js`, `feedback.js`, `progress.js` e `support.js` são usados ativamente; `auth.js`, `content.js` e `generation.js` permanecem como legado.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```powershell
Copy-Item .env.example .env.local
```

> ⚠️ **Nunca** faça commit de `.env.local` (já está no `.gitignore`).

Variáveis disponíveis:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_API_URL` — URL do backend (apenas legado, usado por `generation.js`; dev: `http://localhost:3000`).
- `VITE_ADSENSE_*` — variáveis do Google AdSense (definidas apenas no `.env.example`; não há integração ativa no código no momento).

> **Configuração em produção:** `src/lib/firebase.js` usa a configuração oficial do projeto `flashcardsia-a2f43` como fallback quando as variáveis `VITE_*` não estão definidas. Assim, o site funciona mesmo quando o Hosting não injeta variáveis de ambiente. A configuração do Firebase Web não é um segredo: ela identifica o projeto.

## Camada Firestore

O schema oficial do aplicativo usa a hierarquia de conteúdo:

```text
subjects/{sha1(subject)}
        ↓
curricula/{sha1(subject|level)}
        ↓
cardBuckets/{sha1(subject|topic|level|cardType)}
        ↓
cards[]
```

No entanto, o site atual **estuda a partir da coleção `decks`** (baralhos do usuário sincronizados), não de `curricula`/`cardBuckets`. O arquivo `src/services/content.js` contém a leitura do schema de conteúdo (cálculo de SHA-1, `getDoc()` direto), mas é **legado** — não é importado por nenhum arquivo ativo.

As solicitações de suporte/feedback enviadas pelo site vão para a coleção **`supportRequests`** (via `src/services/support.js`).

## Correção do login Google

Arquivos: `src/lib/firebase.js`, `src/main.jsx`.

Correções aplicadas:

1. Persistência local do Firebase Auth (`browserLocalPersistence`).
2. Estado `authReady` para não deixar o botão parecer travado durante a inicialização.
3. Estado `authBusy` durante login/logout.
4. Tratamento de erros do Google/Firebase.
5. Fallback automático de popup para redirect quando o navegador bloqueia popup.
6. `getRedirectResult()` ao retornar do Google.
7. `prompt: select_account` para facilitar troca de conta.

> Se aparecer `auth/unauthorized-domain`, o código está funcionando: falta adicionar o domínio do site em Firebase Console → Authentication → Settings → **Authorized domains**. Para localhost, confirme que `localhost` está autorizado.

## Login obrigatório e sincronização de baralhos

O site **removeu o modo visitante**: a área de estudos só é liberada depois do login com Google. Após autenticar, ele escuta a coleção `decks` do mesmo Firebase usado pelo aplicativo mobile:

```text
Google Auth
   ↓
uid
   ↓
Firestore /decks
   ↓
userId == uid
   ↓
baralhos + cards
   ↓
MemoriaFlash Web
```

Também são aceitos os decks `public` e `system`, seguindo as regras atuais do aplicativo. No mobile, o serviço oficial já sincroniza `decks` com `where('userId', 'in', [userId, 'public', 'system'])` — o site usa o mesmo contrato.

Arquivos: `src/services/decks.js` (`subscribeToUserDecks`, `flattenDeckCards`).

> Importante: o app mobile mantém uma camada local (`localStorage`) e também possui o serviço de sincronização Firestore. Para um deck aparecer no site, ele precisa estar salvo na coleção `decks` do Firebase com `userId` igual ao UID do Google.

## Sessão de estudo (SRS)

A sessão de estudo (`src/components/StudySession.jsx`) implementa um sistema de repetição espaçada (SRS):

- Ordena a fila por cards **vencidos** primeiro (por `dueDate`) e depois por menor número de repetições.
- Botões **Difícil / Bom / Fácil** com cálculo de intervalo, fator de facilidade (SM-2 simplificado) e nova `dueDate`.
- Salva o progresso via `saveCardProgress` (`src/services/progress.js`).
- Permite feedback por card via `saveCardFeedback` (`src/services/feedback.js`).
- Permite **relatar um card com problema** direto da sessão, enviando o card e o contexto para análise.

## Ajuda e feedback

A aba **Ajuda** (`src/components/HelpPage.jsx`) oferece um formulário de suporte com tipos: card com problema, resposta errada, sugestão, elogio, problema no site ou outro assunto.

O envio usa `submitSupportRequest` (`src/services/support.js`), que grava na coleção **`supportRequests`** do Firestore com o card associado (frente, verso, baralho, matéria/assunto) quando o relato vem de uma sessão de estudo. Não há mais envio por `mailto` (o antigo `public/help.js` é legado).

## Criação de cards

O site **não cria nem gera cards**: a criação e a geração de conteúdo acontecem no aplicativo mobile. A navegação da área privada tem apenas **Início**, **Biblioteca**, **Progresso** e **Ajuda** — não há interface de criação de cards.

Os serviços `src/services/generation.js` (`generateFlashcards` e `getAiStatus`) e `createUserDeck` (`decks.js`) permanecem no repositório apenas como legado — não são importados por nenhum arquivo ativo.
