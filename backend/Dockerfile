FROM node:20-slim

WORKDIR /app

# libs necessárias para compilar o better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# pasta de dados persistente (monte um volume aqui no seu provedor de nuvem
# para os dados sobreviverem a cada novo deploy)
RUN mkdir -p /app/data /app/uploads
VOLUME ["/app/data", "/app/uploads"]

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
