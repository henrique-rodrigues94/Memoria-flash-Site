# MemoriaFlash Web

Site web de estudos do MemoriaFlash, alinhado com o schema oficial do aplicativo.

Branch: `web/firebase-data-layer`

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
2. **Regras do Firestore**: revise o `firestore.rules` para permitir que usuários autenticados leiam/criem seus próprios decks.
3. **Backend de IA**: adicione `VITE_API_URL` apontando para a URL HTTPS do backend para ativar a geração de cards por IA.
4. **AdSense**: preencha os slots no `.env` com os IDs aprovados pelo Google para ativar a publicidade.

## Estrutura do projeto

```text
src/
├── components/
│   ├── AdSlot.jsx
│   ├── AuthGate.jsx
│   ├── EmptyState.jsx
│   ├── Feedback.jsx
│   ├── LoadingState.jsx
│   ├── StudyHeader.jsx
│   └── StudySession.jsx
├── lib/
│   └── firebase.js
├── services/
│   ├── auth.js
│   ├── content.js
│   ├── decks.js
│   ├── feedback.js
│   ├── generation.js
│   └── progress.js
├── main.jsx
└── styles.css
```

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
- `VITE_API_URL` — URL do backend (dev: `http://localhost:3000`; produção: HTTPS do backend).
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

## Geração sincronizada (IA)

O site **não** cria um banco próprio de flashcards. A geração usa o mesmo endpoint do backend do aplicativo:

```text
POST /api/gemini/generate-flashcards
```

Com:

```text
sourceType = subject
subject
topic
educationLevel
cardContentType
```

O backend consulta o banco compartilhado antes da IA e salva os cards gerados no `cardBuckets` oficial.

```text
Mobile
   │
   ├── gera/estuda ──┐
   │                 │
Web ── gera/estuda ──┼── Firebase/cardBuckets
                     │
Content Agent ───────┘
```

Serviço: `src/services/generation.js` (funções `generateFlashcards` e `getAiStatus`).

### Privacidade

O schema atual do backend usa `cardBuckets` como banco de conteúdo **compartilhado** (leitura pública; escrita feita pelo servidor). Cards gerados por `sourceType=subject` são conteúdo compartilhado, não um baralho privado por usuário.

Se o produto precisar de "Meus cards" privados, isso deve ser uma segunda camada do Firebase, por exemplo `users/{uid}/cards/{cardId}` — **sem** misturar com `cardBuckets`. Essa separação deve ser implementada somente quando o aplicativo mobile também passar a usar o mesmo contrato para cards privados.
