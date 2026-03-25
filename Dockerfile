FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY . /app
RUN rm -rf /app/.git /app/.github /app/Dockerfile /app/.gitignore /app/.gitattributes
