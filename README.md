# MemoriaFlash Web

Site web de estudos do MemoriaFlash, alinhado com o schema oficial do aplicativo.

Branch: `main`

## Stack

- React 19
- Vite
- Firebase SDK (Auth + Firestore)
- Firebase Hosting

## Rodar localmente

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

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
2. **Regras do Firestore**: revise as regras para permitir que usuários autenticados leiam/criem seus próprios decks (coleção `decks`).
3. **AdSense**: preencha os slots no `.env` com os IDs aprovados pelo Google para ativar a publicidade.

## Estrutura do projeto

```text
src/
├── components/
│   └── StudySession.jsx      # sessão de estudo imersiva (SRS + feedback)
├── lib/
│   └── firebase.js           # inicialização do Firebase (Auth + Firestore)
├── services/
│   ├── decks.js              # sincronização de baralhos do usuário
│   ├── feedback.js           # feedback de cards
│   ├── progress.js           # progresso/revisão de cards
│   ├── auth.js               # autenticação (legado — centralizada no main.jsx)
│   ├── content.js            # leitura de conteúdo do schema oficial (legado)
│   └── generation.js         # geração por IA (desativada no momento)
├── main.jsx                  # app principal + autenticação
├── styles.css                # estilos gerais
└── study.css                 # estilos da sessão de estudo
```

> O app é renderizado de forma **monolítica** em `src/main.jsx` (login, home, biblioteca, progresso e sessão de estudo). Apenas `decks.js`, `feedback.js` e `progress.js` são usados ativamente; `auth.js`, `content.js` e `generation.js` permanecem no repositório como legado.

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
- `VITE_ADSENSE_CLIENT` — `ca-pub-...` do AdSense.
- `VITE_ADSENSE_HOME_SLOT`, `VITE_ADSENSE_LIBRARY_SLOT`, `VITE_ADSENSE_STUDY_SLOT`, `VITE_ADSENSE_GENERATE_SLOT`, `VITE_ADSENSE_STATS_SLOT` — slots de anúncio por página (deixe vazios até a aprovação do Google).

## Camada Firestore

O site está alinhado ao schema oficial do aplicativo:

```text
subjects/{sha1(subject)}
        ↓
curricula/{sha1(subject|level)}
        ↓
cardBuckets/{sha1(subject|topic|level|cardType)}
        ↓
cards[]
```

O site **não** faz consultas compostas em `curricula` ou `cardBuckets` — ele calcula o mesmo SHA-1 usado pelo backend e usa `getDoc()` diretamente:

- 1 leitura por currículo selecionado;
- 1 leitura por bucket de cards;
- menor chance de exigir índices compostos;
- menos consultas;
- alinhamento com o backend oficial.

Arquivo principal: `src/services/content.js`.

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

## Geração de cards (criação manual)

A geração de cards por IA foi **removida** do site (decisão de manter o foco apenas em estudar). O código ainda contém a aba de **criação manual** de flashcards (`src/main.jsx` → `tab==="generate"`), mas ela **não aparece na navegação** (Início, Meus baralhos, Progresso).

O serviço `src/services/generation.js` (`generateFlashcards` e `getAiStatus`) permanece no repositório apenas como legado — não é importado por nenhum arquivo ativo.
