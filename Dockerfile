FROM node:22

WORKDIR /app

COPY package.json ./
COPY server/package.json ./server/
RUN npm install

COPY . .

EXPOSE 3001
EXPOSE 5173

CMD ["npm", "run", "dev"]