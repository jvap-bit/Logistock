# LogistockPro
Site LogistockPro é um site de sistema de gestão de pedidos onde nele consta sistema erp e sistema python


## Banco de dados (Firebase Realtime Database)

1. Crie um projeto em https://console.firebase.google.com e ative o **Realtime Database**.
2. Em *Configurações do projeto → Seus apps → Web*, copie a configuração e cole em `web/assets/js/firebase-config.js`.
3. Em *Realtime Database → Regras*, cole o conteúdo de `database.rules.json` e publique.
4. Abra o site por `localhost` ou HTTPS (ex.: extensão Live Server) — o hash de senha usa Web Crypto.

### O que é salvo
| Caminho | Conteúdo |
|---|---|
| `usuarios/{uid}` | perfil, matrícula, foto, tema |
| `credenciais/{uid}` | salt + hash SHA-256 da senha |
| `emails/{chave}` | índice e-mail → uid (login / e-mail único) |
| `avaliacoes`, `propostas`, `contatos` | formulários do site |
| `consultasRastreio`, `cotacoesFrete` | página de rastreio |
| `chats/{uid}` | histórico do chatbot |
| `pedidos/{OP}` | pedidos lidos pelo leitor de QR Code (cadastre-os pelo console/ERP) |
| `leituras` | registros de leituras de QR Code |

Exemplo de pedido: `pedidos/12345 → { cliente, produto, quantidade, endereco, cep, status }`.
