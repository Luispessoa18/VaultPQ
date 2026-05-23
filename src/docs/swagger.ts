export const swaggerHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>SecureVault PQ - Documentação e Tutorial</title>
  <link rel="stylesheet" type="text/css" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; }
    .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.js"></script>
  <script>
  window.onload = function() {
    const spec = {
      openapi: "3.0.0",
      info: {
        title: "SaaS: SecureVault PQ (inclui KMS)",
        version: "4.0.0",
        description: "# Plataforma Completa de Segurança e Criptografia B2B\\n\\nOferecemos a tripla proteção B2B perfeita:\\n1. **KMS as a Service (NOVO)**: Gerenciamento e uso de Chaves (Encrypt, Decrypt, Data Keys) e Backup Shamir.\\n2. **Proteção In Transit (Firewall API)**: Mutal TLS, Prevenção MITM, Anti-Replay e JWT Híbrido.\\n3. **Proteção At Rest (Guardião Zero-Knowledge)**: Tratamento e criptografia de registros em Bancos de Dados.\\n\\n🔗 **[Acessar Painel Admin de Métricas e Clientes](/admin-panel)**"
      },
      servers: [{ url: "http://localhost:3000", description: "Servidor SaaS Local" }],
      components: {
        securitySchemes: {
          ApiKeyAuth: { type: "apiKey", in: "header", name: "x-api-key", description: "Use: sk_test_123456789" },
          BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Para as rotas de Firewall, use o JWT obtido." }
        }
      },
      security: [{ ApiKeyAuth: [] }],
      tags: [
        { name: "🔑 0. KMS as a Service (Virtual HSM)", description: "Operações Criptográficas diretas com Chaves Isoladas do Inquilino." },
        { name: "🔒 1. Firewall Criptográfico para APIs", description: "Proteção de tráfego (Anti-Replay, Fingerprint, JWT e Assinaturas Digitais)" },
        { name: "🛡️ 2. Modo Guardião (Data At Rest)", description: "Criptografia de Bancos de Dados delegada" }
      ],
      paths: {
        "/kms/generate-data-key": {
          post: {
            tags: ["🔑 0. KMS as a Service (Virtual HSM)"],
            summary: "AWS KMS-Like: Gera uma Chave de Dados (Data Key)",
            description: "Útil para Envelopamento (Envelope Encryption). Retorna a chave legível para você usar no momento, e uma cópia blindada para você guardar no seu banco de dados.",
            responses: { "200": { description: "Retorna o Plaintext e o CiphertextBlob" } }
          }
        },
        "/kms/encrypt": {
          post: {
            tags: ["🔑 0. KMS as a Service (Virtual HSM)"],
            summary: "Criptografa um dado utilizando a chave Master do Inquilino",
            requestBody: {
              content: { "application/json": {
                schema: { type: "object" },
                example: { plaintext: "A chave secreta da minha startup é 12345" }
              }}
            },
            responses: { "200": { description: "Retorna o CiphertextBlob contendo IV, Tag, Hash e Versão" } }
          }
        },
        "/kms/decrypt": {
          post: {
            tags: ["🔑 0. KMS as a Service (Virtual HSM)"],
            summary: "Descriptografa um Ciphertext gerado pelo KMS",
            requestBody: {
              content: { "application/json": {
                schema: { type: "object" },
                example: { ciphertext_blob: "COLE_O_CIPHERTEXT_BLOB_GERADO_AQUI" }
              }}
            },
            responses: { "200": { description: "Retorna o texto original (Plaintext)" } }
          }
        },
        "/kms/export-backup": {
          post: {
            tags: ["🔑 0. KMS as a Service (Virtual HSM)"],
            summary: "Gera Backup Anti-Extração (Shamir Secret Sharing)",
            description: "Divide a chave de criptografia do Inquilino em N pedaços, precisando de no mínimo K pedaços para restaurá-la (Ideal para diretores de empresa ou cofre físico multi-região).",
            requestBody: {
              content: { "application/json": {
                schema: { type: "object" },
                example: { shares: 3, threshold: 2 }
              }}
            },
            responses: { "200": { description: "Retorna as fatias da chave" } }
          }
        },
        "/firewall/issue-jwt": {
          post: {
            tags: ["🔒 1. Firewall Criptográfico para APIs"],
            summary: "Emite um JWT seguro usando o segredo HSM (Troque API Key por Token JWT temporário)",
            responses: { "200": { description: "Retorna o Token JWT" } }
          }
        },
        "/firewall/demo-sign": {
          post: {
            tags: ["🔒 1. Firewall Criptográfico para APIs"],
            summary: "Helper: Calcula a assinatura exigida pelo Firewall",
            requestBody: {
              content: { "application/json": {
                schema: { type: "object" },
                example: { body_payload: { meu: "dado" }, nonce: "abc-123-nonce", timestamp: "1700000000000" }
              }}
            },
            responses: { "200": { description: "Assinatura Retornada" } }
          }
        },
        "/firewall/protected-resource": {
          post: {
            tags: ["🔒 1. Firewall Criptográfico para APIs"],
            summary: "Rota blindada pelo Firewall API (Exige Assinatura)",
            security: [{ BearerAuth: [] }],
            parameters: [
              { in: "header", name: "x-nonce", required: true, schema: { type: "string", example: "abc-123-nonce" } },
              { in: "header", name: "x-timestamp", required: true, schema: { type: "string", example: "1700000000000" } },
              { in: "header", name: "x-signature", required: true, schema: { type: "string", example: "COLE_ASSINATURA_AQUI" } }
            ],
            requestBody: {
              content: { "application/json": { 
                schema: { type: "object" },
                example: { meu: "dado" } 
              } }
            },
            responses: { "200": { description: "Passou pelo Firewall!" } }
          }
        },
        "/secure-schema": {
          post: {
            tags: ["🛡️ 2. Modo Guardião (Data At Rest)"],
            summary: "Define regras de criptografia para uma tabela",
            requestBody: {
              content: { "application/json": {
                schema: { type: "object" },
                example: { name: "users_v1", fields: { cpf: "token", email: "token+encrypt", password: "password" } }
              }}
            },
            responses: { "200": { description: "Sucesso" } }
          }
        },
        "/secure-record": {
          post: {
            tags: ["🛡️ 2. Modo Guardião (Data At Rest)"],
            summary: "Recebe dados crus e devolve o Payload Seguro",
            requestBody: {
              content: { "application/json": {
                schema: { type: "object" },
                example: { schema_name: "users_v1", data: { cpf: "12345678900", email: "usuario@email.com", password: "MinhaSenha@123" } }
              }}
            },
            responses: { "200": { description: "Payload Criptografado Pronto para Salvar" } }
          }
        },
        "/keys/rotate": {
          post: {
            tags: ["🛡️ 2. Modo Guardião (Data At Rest)"],
            summary: "Rotaciona e versiona chaves ativas do inquilino",
            responses: { "200": { description: "Rotacionado com sucesso" } }
          }
        }
      }
    };

    window.ui = SwaggerUIBundle({
      spec: spec,
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [ SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset ],
      layout: "BaseLayout"
    });
  };
  </script>
</body>
</html>
`