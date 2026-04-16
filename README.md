# Motor de Cálculo de Rating Assíncrono

![Node.js](https://img.shields.io/badge/node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Express.js](https://img.shields.io/badge/express.js-404D59?style=for-the-badge&logo=express&logoColor=61DAFB)
![Prisma](https://img.shields.io/badge/prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/postgresql-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/redis-D82C20?style=for-the-badge&logo=redis&logoColor=white)
![BullMQ](https://img.shields.io/badge/BullMQ-FF6A00?style=for-the-badge)

Uma API assíncrona construída com Node.js, Express, Prisma e BullMQ para processar partidas e recalcular o rating de jogadores em background com consistência transacional.

## Tecnologias

- **Node.js 18.18+** (Ambiente de execução JavaScript)
- **TypeScript** (Tipagem estática para segurança e manutenção)
- **Express** (Framework para construção da API HTTP)
- **Prisma ORM** (Acesso e modelagem de dados com PostgreSQL)
- **PostgreSQL** (Banco de dados relacional)
- **Redis** (Backend da fila BullMQ)
- **BullMQ** (Orquestração de jobs assíncronos)

### Funcionalidades

- **Criação de Partidas:** Recebe resultados via endpoint HTTP e persiste no banco.
- **Processamento Assíncrono:** Enfileira jobs de rating para execução em background.
- **Cálculo de Elo:** Recalcula rating dos dois jogadores por partida processada.
- **Consistência de Dados:** Usa transação serializable, lock pessimista e retry para erros transitórios.

### Pré-requisitos

- Node.js 18.18+
- PostgreSQL
- Redis

### Instalação

```bash
git clone https://github.com/caiolucasbittencourt/motor-de-calculo-de-rating-assincrono.git
cd motor-de-calculo-de-rating-assincrono
npm install
```

### Configuração

Crie um arquivo `.env` na raiz do projeto baseado no `.env.example`:

```bash
cp .env.example .env
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Variáveis esperadas:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rating_engine?schema=public"
REDIS_HOST="127.0.0.1"
REDIS_PORT="6379"
PORT="3000"
RATING_WORKER_CONCURRENCY="5"
```

### Executando

#### Desenvolvimento (local)

```bash
# Terminal 1 (API)
npm run dev

# Terminal 2 (Worker)
npm run worker:dev
```

#### Produção

```bash
npm run build

# Terminal 1 (API)
npm run start

# Terminal 2 (Worker)
npm run worker:start
```

#### Migrações

```bash
npm run prisma:generate
npm run prisma:deploy
```

### Scripts

| Script                    | Descrição                                                         |
| ------------------------- | ----------------------------------------------------------------- |
| `npm run dev`             | Inicia a API em desenvolvimento com hot-reload                    |
| `npm run worker:dev`      | Inicia o worker em desenvolvimento com hot-reload                 |
| `npm run build`           | Compila o projeto TypeScript                                      |
| `npm test`                | Executa os testes unitários e de integração                       |
| `npm run test:watch`      | Executa os testes em modo watch                                   |
| `npm run start`           | Inicia a API compilada                                            |
| `npm run worker:start`    | Inicia o worker compilado                                         |
| `npm run prisma:generate` | Gera o Prisma Client a partir do schema                           |
| `npm run prisma:migrate`  | Executa migrações em modo de desenvolvimento                      |
| `npm run prisma:deploy`   | Aplica migrações versionadas (fluxo recomendado para repositório) |

### Rotas e Arquitetura

#### Rotas HTTP

| Método | Rota       | Descrição                                                        |
| ------ | ---------- | ---------------------------------------------------------------- |
| POST   | `/matches` | Registra partida pendente e enfileira job para cálculo de rating |

**Exemplo de request:**

```json
{
  "player1Id": 1,
  "player2Id": 2,
  "winnerId": 1
}
```

**Exemplo de resposta:**

```json
{
  "status": "accepted",
  "matchId": 123
}
```

#### Arquitetura de Processamento

| Componente     | Responsabilidade                                                      |
| -------------- | --------------------------------------------------------------------- |
| API (Express)  | Valida payload, cria `MatchRecord` com status `PENDING` e publica job |
| Fila (BullMQ)  | Gerencia enfileiramento, retry e backoff dos jobs                     |
| Worker         | Busca partida e jogadores, calcula Elo e executa atualizações         |
| Banco (Prisma) | Persiste dados com transação serializable e atualização atômica       |

## License

Source code is licensed under **MIT**.
