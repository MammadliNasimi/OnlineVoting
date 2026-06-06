FROM node:18-alpine
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy app sources
COPY . .

# Expose port
EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "server.js"]
