# Dockerfile for Cortana Dashboard

FROM node:18-alpine

WORKDIR /usr/src/app

# Install dependencies deterministically
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the application source code
COPY . .

# Run as non-root
USER node

# The app listens on 3000 (see server.js)
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
