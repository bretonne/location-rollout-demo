# Use Node.js 18 as the base image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json (if exists)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Build the application
RUN npm run build

# Expose port for preview (optional, for running the app)
EXPOSE 4173

# Command to serve the built app
CMD ["npm", "run", "preview"]