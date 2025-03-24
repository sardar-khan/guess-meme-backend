FROM node:18
WORKDIR /app
# Copy package.json and package-lock.json
COPY package.json package-lock.json ./
RUN npm install
COPY . .   
EXPOSE 5000
CMD ["node", "src/index.js"]
