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
- `VITE_ADSENSE_ENABLED` — `false` por padrão. Ative somente depois da aprovação do AdSense.

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
