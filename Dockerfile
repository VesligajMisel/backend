FROM node:alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json (if available) first to leverage Docker cache
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all necessary files at once
COPY . .

# Expose the application port
EXPOSE 3000

# Run the app
CMD ["npm", "start"]
