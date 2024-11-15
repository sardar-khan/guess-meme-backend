# Use the official Node.js 18 image as the base
FROM node:18

# Set the working directory inside the container
WORKDIR /app

# Copy only package.json and package-lock.json to install dependencies
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the entire project, including the .env file
COPY . .

# Expose the application port
EXPOSE 5000

# Run the application
CMD ["npm", "run", "start"]
