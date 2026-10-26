FROM nginx:1.27-alpine

# Remove default nginx static files and config
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

# Copy custom offline-enforced nginx configuration
COPY nginx.conf /etc/nginx/conf.d/blurrise.conf

# Copy Blurrise web application static assets
COPY public/ /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
