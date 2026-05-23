FROM node:20-bullseye

WORKDIR /app

# Copia apenas os arquivos de dependência primeiro para aproveitar o cache do Docker
COPY package*.json ./

# Instala as dependências padrões do projeto
RUN npm install

# Copia o restante do código
COPY tsconfig.json ./
COPY src ./src

# Compila o TypeScript para JavaScript
RUN npm run build

# Expõe a porta da API
EXPOSE 3000

# Inicia o servidor
CMD ["npm", "start"]