# Stage 1: Build the React app
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --quiet --no-fund --no-audit

# Copy the rest of the source code
COPY . .

# Build-time args passed from Cloud Build
ARG REACT_APP_API_URL
ARG REACT_APP_STRIPE_PUBLIC_KEY
ARG REACT_APP_GTM_ID

# Build the app (CI=false to treat warnings as warnings, not errors)
ENV CI=false
ENV NODE_ENV=production
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_STRIPE_PUBLIC_KEY=$REACT_APP_STRIPE_PUBLIC_KEY
ENV REACT_APP_GTM_ID=$REACT_APP_GTM_ID
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:stable-alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from build stage
COPY --from=build /app/build /usr/share/nginx/html

# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
