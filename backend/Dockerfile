FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 3000

# `migrate deploy` applique l'historique de migrations, comme render.yaml.
# L'ancien `db push --accept-data-loss` pouvait SUPPRIMER des colonnes pour
# forcer la convergence du schéma — jamais contre une base de production.
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
