FROM node:18
WORKDIR /app
COPY package*.json ./
COPY .env .env  
RUN npm install
COPY . .   
EXPOSE 5000
CMD ["npm", "run", "start"]
