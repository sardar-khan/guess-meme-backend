FROM node:18
WORKDIR /app
# Copy package.json and package-lock.json
COPY package*.json ./
RUN npm install
COPY . .   
EXPOSE 5000
CMD ["npm", "start"]
